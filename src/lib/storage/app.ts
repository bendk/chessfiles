import type { ChessfilesStorage, DirEntry, PathComponent } from ".";
import { filename, joinPath, pathComponents } from ".";
import { AppMetaManager } from "./meta";
import { Book } from "~/lib/node";
import { newLibraryActivity } from "~/lib/activity";
import type { Activity, TrainingActivity } from "~/lib/activity";
import { StatusTracker } from "~/components";
import type { TrainingMeta, TrainingSettings } from "~/lib/training";
import { Training } from "~/lib/training";
import * as dropbox from "~/lib/auth/dropbox";
import { FileExistsError, FileNotFoundError, normalizePath } from "./base";
import { ChessfilesStorageLocal } from "./local";
import { ChessfilesStorageDropbox } from "./dropbox";

import { createMemo, createSignal } from "solid-js";

export interface TrainingListing {
  metas: TrainingMeta[];
  activity: TrainingActivity[];
}

interface StorageEngines {
  local: ChessfilesStorage;
  dropbox: ChessfilesStorage;
}

/**
 * High-level storage API
 *
 * - Individual storage engines (local, dropbox) are children of the root directory.
 * - Operates on books/training instances rather than file contents
 * - Is owned by the `App` component and persists across page changes.
 */
export class AppStorage {
  dir: () => string;
  dirComponents: () => PathComponent[];
  status: StatusTracker;
  files: () => DirEntry[];
  loading: () => boolean;
  private setFiles: (files: DirEntry[] | undefined) => void;
  private setDirPath: (dir: string) => void;
  private setLoading: (loading: boolean) => void;
  private storage: StorageEngines;
  private metaManager: Promise<AppMetaManager>;

  constructor(storage?: StorageEngines, initialDir: string = "/") {
    this.storage = storage ?? {
      local: new ChessfilesStorageLocal(),
      dropbox: new ChessfilesStorageDropbox(),
    };
    this.metaManager = AppMetaManager.load(this.allStorageEngines());
    this.status = new StatusTracker();
    [this.dir, this.setDirPath] = createSignal(initialDir);
    this.dirComponents = createMemo(() => pathComponents(this.dir()));
    [this.files, this.setFiles] = createSignal([]);
    [this.loading, this.setLoading] = createSignal(false);
    this.refetchFiles();
  }

  clone(): AppStorage {
    return new AppStorage(this.storage, this.dir());
  }

  async refetchFiles() {
    if (this.dir() == "/") {
      this.setFiles(
        this.allStorageEngines().map(([name]) => ({
          filename: name,
          type: "engine",
        })),
      );
      return;
    }

    this.setLoading(true);
    const [storage, dir] = this.resolvePath(this.dir());

    try {
      const files = (await storage.listDir(dir)).filter(
        (entry) => !this.isSpecialFile(dir, entry),
      );
      files.sort((a, b) => {
        if (a.type == "dir" && b.type == "file") return -1;
        if (a.type == "file" && b.type == "dir") return 1;
        return a.filename.localeCompare(b.filename);
      });
      this.setFiles(files);
    } finally {
      this.setLoading(false);
    }
  }

  private resolvePath(path: string): [ChessfilesStorage, string] {
    path = joinPath(this.dir(), path);
    const [name, engine] = this.engineForPath(path);
    return [engine, normalizePath(path.substring(name.length + 1))];
  }

  private allStorageEngines(): [string, ChessfilesStorage][] {
    const storages: [string, ChessfilesStorage][] = [
      ["Local Storage", this.storage.local],
    ];
    if (dropbox.isAuthorized()) {
      storages.push(["Dropbox", this.storage.dropbox]);
    }
    return storages;
  }

  private engineForPath(path: string): [string, ChessfilesStorage] {
    path = joinPath(this.dir(), path);
    for (const [name, engine] of this.allStorageEngines()) {
      if (path.startsWith(`/${name}`)) {
        return [name, engine];
      }
    }
    throw new FileNotFoundError(path);
  }

  toplevelStorageEngines(): string[] {
    return this.allStorageEngines().map(([name]) => name);
  }

  setDir(path: string) {
    if (!path.startsWith("/")) {
      path = joinPath(this.dir(), path);
    }
    this.setDirPath(path);
    this.refetchFiles();
  }

  async listDir(path: string): Promise<DirEntry[]> {
    const [storage, storagePath] = this.resolvePath(path);
    return await storage.listDir(storagePath);
  }

  async readFile(path: string): Promise<string> {
    const [storage, storagePath] = this.resolvePath(path);
    return await storage.readFile(storagePath);
  }

  async writeFile(path: string, content: string) {
    const [storage, storagePath] = this.resolvePath(path);
    if (await storage.exists(storagePath)) {
      await storage.writeFile(storagePath, content);
    } else {
      await storage.createFile(storagePath, content);
    }
  }

  async readBook(path: string): Promise<Book> {
    return Book.import(await this.readFile(path));
  }

  async writeBook(path: string, book: Book): Promise<void> {
    const metaManager = await this.metaManager;
    path = joinPath(this.dir(), path);
    await this.writeFile(path, book.export());
    await metaManager.addActivity(newLibraryActivity(filename(path)), path);
  }

  async exists(path: string): Promise<boolean> {
    try {
      const [storage, storagePath] = this.resolvePath(path);
      return await storage.exists(storagePath);
    } catch (e) {
      if (e instanceof FileNotFoundError) {
        return false;
      }
      throw e;
    }
  }

  async createDir(path: string) {
    const [storage, storagePath] = this.resolvePath(path);
    await storage.createDir(storagePath);
  }

  private async deleteFile(path: string) {
    const [storage, storagePath] = this.resolvePath(path);
    await storage.remove(storagePath);
  }

  absPath(path: string): string {
    return joinPath(this.dir(), path);
  }

  async rename(filename: string, newFilename: string) {
    const sourcePath = joinPath(this.dir(), filename);
    const destPath = joinPath(this.dir(), newFilename);
    const [storage, sourceStoragePath] = this.resolvePath(sourcePath);
    const [storage2, destStoragePath] = this.resolvePath(destPath);
    // Both storages should be the same since they're from the same directory
    if (storage != storage2) {
      throw Error("rename: storage != storage2");
    }
    console.log(sourceStoragePath, destStoragePath);
    await storage.move(sourceStoragePath, destStoragePath);
    this.refetchFiles();
  }

  async move(
    sourceFiles: DirEntry[],
    destDir: string,
    callbacks: OperationCallbacks,
  ) {
    const steps = await this.planCopyOrMove(sourceFiles, destDir, "move-file");
    await this.performOperation(steps, callbacks);
    this.refetchFiles();
  }

  async copy(
    sourceFiles: DirEntry[],
    destDir: string,
    callbacks: OperationCallbacks,
  ) {
    const steps = await this.planCopyOrMove(sourceFiles, destDir, "copy-file");
    await this.performOperation(steps, callbacks);
    this.refetchFiles();
  }

  async delete(files: DirEntry[], callbacks: OperationCallbacks) {
    const steps = this.planDelete(files);
    await this.performOperation(steps, callbacks);
    this.refetchFiles();
  }

  /**
   * Generate a list of steps to perform a copy/move
   */
  private async planCopyOrMove(
    sourceFiles: DirEntry[],
    destDir: string,
    fileOpType: "move-file" | "copy-file",
  ): Promise<OperationStep[]> {
    const steps: OperationStep[] = [];
    const dir = this.dir();

    for (const sourceFile of sourceFiles) {
      const sourcePath = joinPath(dir, sourceFile.filename);
      const destPath = joinPath(destDir, sourceFile.filename);
      if (sourceFile.type == "file") {
        steps.push({ type: fileOpType, sourcePath, destPath });
      } else {
        const recursiveListing = await this.recursiveListDir(sourcePath);
        for (const [relpath, entries] of recursiveListing) {
          const sourceBase = joinPath(sourcePath, relpath);
          const destBase = joinPath(destPath, relpath);
          steps.push({ type: "ensure-dir", path: destBase });
          for (const e of entries) {
            const sourcePath = joinPath(sourceBase, e.filename);
            const destPath = joinPath(destBase, e.filename);
            if (e.type == "file") {
              steps.push({ type: fileOpType, sourcePath, destPath });
            }
          }
          // Remove directories that were moved out of:
          //  - Make sure to remove directories children first
          //  - Don't remove directories inside destDir (i.e. we moved a directory
          //    into a subdirectory of itself).
          recursiveListing.reverse();
          for (const [relpath] of recursiveListing) {
            const path = joinPath(sourcePath, relpath);
            if (!path.startsWith(destDir) && fileOpType != "copy-file") {
              steps.push({ type: "remove-dir", path });
            }
          }
        }
      }
    }
    if (fileOpType == "move-file") {
      steps.push({ type: "update-metadata-on-move" });
    }
    return steps;
  }

  /**
   * Generate a list of steps to perform a delete
   */
  private planDelete(files: DirEntry[]): OperationStep[] {
    const dir = this.dir();
    const paths: string[] = [];
    const steps: OperationStep[] = [];

    for (const e of files) {
      const path = joinPath(dir, e.filename);
      paths.push(path);
      if (e.type == "file") {
        steps.push({ type: "delete-file", path });
      } else {
        steps.push({ type: "remove-dir", path });
      }
    }
    steps.push({ type: "update-metadata-on-delete", paths });
    return steps;
  }

  async performOperation(
    steps: OperationStep[],
    callbacks: OperationCallbacks,
    dryRun?: boolean,
  ) {
    let currentWork = 0;
    let totalWork = 0;
    const movedPaths: [string, string][] = [];
    for (const step of steps) {
      totalWork += this.workForStep(step);
    }
    for (const step of steps) {
      if (callbacks.canceled ? callbacks.canceled() : false) {
        break;
      }
      if (step.type == "ensure-dir") {
        const [storage, storagePath] = this.resolvePath(step.path);
        if (!(await storage.exists(storagePath))) {
          callbacks.log?.(`creating directory ${step.path}`);
          if (!dryRun) {
            await storage.createDir(storagePath);
          }
        }
      } else if (step.type == "remove-dir") {
        const [storage, storagePath] = this.resolvePath(step.path);
        callbacks.log?.(`removing directory ${step.path}`);
        if (!dryRun) {
          await storage.remove(storagePath);
        }
      } else if (step.type == "delete-file") {
        const [storage, storagePath] = this.resolvePath(step.path);
        callbacks.log?.(`deleting ${step.path}`);
        if (!dryRun) {
          await storage.remove(storagePath);
        }
      } else if (step.type == "move-file") {
        const [sourceEngine, sourceEnginePath] = this.resolvePath(
          step.sourcePath,
        );
        const [destEngine, destEnginePath] = this.resolvePath(step.destPath);

        const exists = await destEngine.exists(destEnginePath);
        if (exists) {
          if (callbacks.shouldOverwrite === undefined) {
            throw new FileExistsError(step.destPath);
          }
          if (!(await callbacks.shouldOverwrite(step.destPath))) {
            callbacks.log?.(`skipping ${step.sourcePath}`);
            continue;
          }
        }
        if (sourceEngine === destEngine) {
          callbacks.log?.(`moving ${step.sourcePath} -> ${step.destPath}`);
          if (!dryRun) {
            await sourceEngine.move(sourceEnginePath, destEnginePath);
          }
        } else {
          callbacks.log?.(`reading ${step.sourcePath}`);
          const content = await sourceEngine.readFile(sourceEnginePath);
          if (exists) {
            callbacks.log?.(`overwriting ${step.destPath}`);
            if (!dryRun) {
              await destEngine.writeFile(destEnginePath, content);
            }
          } else {
            callbacks.log?.(`creating ${step.destPath}`);
            if (!dryRun) {
              await destEngine.createFile(destEnginePath, content);
            }
          }
          callbacks.log?.(`removing ${step.sourcePath}`);
          if (!dryRun) {
            await sourceEngine.remove(sourceEnginePath);
          }
        }
        movedPaths.push([step.sourcePath, step.destPath]);
      } else if (step.type == "copy-file") {
        const [sourceEngine, sourceEnginePath] = this.resolvePath(
          step.sourcePath,
        );
        const [destEngine, destEnginePath] = this.resolvePath(step.destPath);

        callbacks.log?.(`reading ${step.sourcePath}`);
        const exists = await destEngine.exists(destEnginePath);
        if (exists) {
          if (callbacks.shouldOverwrite === undefined) {
            throw new FileExistsError(step.destPath);
          }
          if (!(await callbacks.shouldOverwrite(step.destPath))) {
            callbacks.log?.(`skipping ${step.sourcePath}`);
            continue;
          }
        }
        const content = await sourceEngine.readFile(sourceEnginePath);
        if (exists) {
          callbacks.log?.(`overwriting ${step.destPath}`);
          if (!dryRun) {
            await destEngine.writeFile(destEnginePath, content);
          }
        } else {
          callbacks.log?.(`creating ${step.destPath}`);
          if (!dryRun) {
            await destEngine.createFile(destEnginePath, content);
          }
        }
      } else if (step.type == "update-metadata-on-move") {
        if (!dryRun && movedPaths.length > 0) {
          const metaManager = await this.metaManager;
          await metaManager.onFilesMoved(movedPaths);
        }
      } else if (step.type == "update-metadata-on-delete") {
        const metaManager = await this.metaManager;
        if (!dryRun) {
          await metaManager.onFilesDeleted(step.paths);
        }
      } else {
        throw Error(`performOperation: invalid step ${step}`);
      }

      currentWork += this.workForStep(step);
      callbacks.progress?.(currentWork, totalWork);
    }
  }

  /**
   * Given a directory, find all descendant paths
   *
   * Returns a list of [relpath, DirEntry[]] pairs.
   * The order is generally unspecified, but parent directories will always come before their
   * children.
   */
  async recursiveListDir(path: string): Promise<[string, DirEntry[]][]> {
    const results: [string, DirEntry[]][] = [];
    const todo = [""];

    while (true) {
      const relativePath = todo.pop();
      if (relativePath === undefined) {
        break;
      }
      const [storage, storagePath] = this.resolvePath(
        joinPath(path, relativePath),
      );
      const entries = await storage.listDir(storagePath);
      results.push([relativePath, entries]);
      for (const entry of entries) {
        if (entry.type != "file") {
          todo.push(joinPath(relativePath, entry.filename));
        }
      }
    }
    return results;
  }

  private workForStep(step: OperationStep): number {
    if (step.type == "ensure-dir") {
      return 1;
    } else if (step.type == "remove-dir") {
      return 3;
    } else if (step.type == "delete-file") {
      return 5;
    } else if (step.type == "move-file" || step.type == "copy-file") {
      return 10;
    } else if (step.type == "update-metadata-on-delete") {
      return 40;
    } else if (step.type == "update-metadata-on-move") {
      return 50;
    }
    throw Error(`workForStep: invalid step ${step}`);
  }

  private isSpecialFile(dir: string, entry: DirEntry): boolean {
    if (
      dir == "/" &&
      (entry.filename == "ChessfilesData.json" ||
        entry.filename == "ChessfilesTraining" ||
        entry.filename == "ChessfilesTrainingSettings")
    ) {
      return true;
    }

    return false;
  }

  async listActivity(): Promise<Activity[]> {
    const metaManager = await this.metaManager;
    return metaManager.listActivity();
  }

  // Training settings are always stored in local storage
  async readTrainingSettings(): Promise<TrainingSettings> {
    const defaultSettings = {
      shuffle: true,
      skipAfter: 2,
      moveDelay: 0.5,
    };
    let storedSettings = {};
    try {
      if (await this.storage.local.exists("/ChessfilesTrainingSettings")) {
        const storedJson = await this.storage.local.readFile(
          "/ChessfilesTrainingSettings",
        );
        storedSettings = JSON.parse(storedJson);
      }
    } catch (e) {
      console.warn(`Error loading stored settings: ${e}`);
    }

    return {
      ...defaultSettings,
      ...storedSettings,
    };
  }

  async saveTrainingSettings(
    trainingSettings: TrainingSettings,
  ): Promise<void> {
    const data = JSON.stringify(trainingSettings);
    if (await this.storage.local.exists("/ChessfilesTrainingSettings")) {
      await this.storage.local.writeFile("/ChessfilesTrainingSettings", data);
    } else {
      await this.storage.local.createFile("/ChessfilesTrainingSettings", data);
    }
  }

  async listTraining(): Promise<TrainingListing> {
    const metaManager = await this.metaManager;
    const trainingMetas = metaManager.listTraining();
    const activity = metaManager.listActivity();
    return {
      metas: trainingMetas,
      activity: activity.filter((a) => a.type == "training").slice(0, 20),
    };
  }

  async createTraining(bookPath: string): Promise<Training> {
    const book = await this.readBook(bookPath);
    const settings = await this.readTrainingSettings();
    const [storageName] = this.engineForPath(bookPath);
    const trainingDir = `/${storageName}/ChessfilesTraining/`;
    const training = Training.create(settings, bookPath, book, trainingDir);

    const metaManager = await this.metaManager;
    metaManager.saveTrainingMeta(training.meta);
    await this.saveTraining(training);
    return training;
  }

  async loadTraining(meta: TrainingMeta): Promise<Training> {
    const settings = await this.readTrainingSettings();
    const pgnData = await this.readFile(meta.trainingBookPath);

    return Training.import(meta, pgnData, settings);
  }

  async updateTraining(training: Training): Promise<void> {
    const metaManager = await this.metaManager;
    await this.saveTraining(training);
    await metaManager.saveTrainingMeta(training.meta);
  }

  async removeTraining(meta: TrainingMeta): Promise<void> {
    const metaManager = await this.metaManager;
    await this.deleteFile(meta.trainingBookPath);
    await metaManager.removeTrainingMeta(meta);
  }

  async restartTraining(meta: TrainingMeta): Promise<Training> {
    const training = await this.loadTraining(meta);
    if (!(await this.exists(meta.sourceBookPath))) {
      throw new FileNotFoundError();
    }
    const book = await this.readBook(meta.sourceBookPath);
    const updated = training.restart(book);
    await this.updateTraining(updated);
    return updated;
  }

  private async saveTraining(training: Training): Promise<void> {
    const metaManager = await this.metaManager;
    await this.writeFile(training.meta.trainingBookPath, training.exportPgn());

    if (
      training.activity.correctCount > 0 ||
      training.activity.incorrectCount > 0
    ) {
      metaManager.addActivity(
        training.activity,
        training.meta.trainingBookPath,
      );
    }
  }

  _metaManagerForTesting(): Promise<AppMetaManager> {
    return this.metaManager;
  }
}

type OperationStep =
  | { type: "ensure-dir"; path: string }
  | { type: "remove-dir"; path: string }
  | { type: "delete-file"; path: string }
  | { type: "move-file"; sourcePath: string; destPath: string }
  | { type: "copy-file"; sourcePath: string; destPath: string }
  | { type: "update-metadata-on-delete"; paths: string[] }
  | { type: "update-metadata-on-move" };

export interface OperationCallbacks {
  shouldOverwrite?: (path: string) => Promise<boolean>;
  progress?: (current: number, total: number) => void;
  canceled?: () => boolean;
  log?: (entry: string) => void;
}
