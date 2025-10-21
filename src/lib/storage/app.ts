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
import {
  FileExistsError,
  FileNotFoundError,
  normalizePath,
} from "./base";
import { ChessfilesStorageLocal } from "./local";
import { ChessfilesStorageDropbox } from "./dropbox";

import { createMemo, createSignal } from "solid-js";

export interface TrainingListing {
  metas: TrainingMeta[];
  activity: TrainingActivity[];
}

interface StorageEngines {
  local: ChessfilesStorageLocal;
  dropbox: ChessfilesStorageDropbox;
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
        return [name, engine]
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
    const metaManager = (await this.metaManager);
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

  async delete(paths: string[]) {
    paths = paths.map((p) => this.absPath(p));
    for (const path of paths) {
      this.deleteFile(path)
    }
    const metaManager = (await this.metaManager);
    await metaManager.onFilesDeleted(paths);
  }

  private async deleteFile(path: string) {
      const [storage, storagePath] = this.resolvePath(path);
      await storage.remove(storagePath);
  }

  absPath(path: string): string {
    return joinPath(this.dir(), path);
  }

  async move(
    sourceFilename: string,
    destPath: string,
  ) {
    const sourcePath = normalizePath(joinPath(this.dir(), sourceFilename));
    const overwriteCallback = (path: string) => {
      throw new FileExistsError(path);
    };
    await this.bulkMove([[sourcePath, destPath]], () => {}, overwriteCallback);
  }

  async bulkMove(
    paths: [string, string][],
    progressCallback: (current: number, total: number) => void,
    overwriteCallback: (path: string) => Promise<boolean>,
  ) {
    const totalItems = paths.length + 1; // 1 for each path, plus one for the `onFilesMoved` call

    // Perform each individual move
    const movedPaths: [string, string][] = [];
    for (let i = 0; i < paths.length; i++) {
      progressCallback(i, totalItems);
      const [sourcePath, destPath] = paths[i];
      const [sourceEngine, sourceEnginePath] = this.resolvePath(sourcePath)
      const [destEngine, destEnginePath] = this.resolvePath(destPath)
      const exists = await destEngine.exists(destEnginePath);

      if (exists) {
        if (!await overwriteCallback(destPath)) {
          continue;
        }
      }
      if (sourceEngine === destEngine) {
        await sourceEngine.move(sourceEnginePath, destEnginePath);
      } else {
        const content = await sourceEngine.readFile(sourceEnginePath);
        if (exists) {
          await destEngine.writeFile(destEnginePath, content);
        } else {
          await destEngine.createFile(destEnginePath, content);
        }
        await sourceEngine.remove(sourceEnginePath);
      }
      movedPaths.push([sourcePath, destPath]);
    }

    // Call `onFilesMoved` to update the training metadata
    progressCallback(paths.length, totalItems);
    const metaManager = (await this.metaManager);
    await metaManager.onFilesMoved(movedPaths);

    // Final progressCallback for 100% completion.
    progressCallback(totalItems, totalItems);
    this.refetchFiles();
  }

  private isSpecialFile(dir: string, entry: DirEntry): boolean {
    if (
      dir == "/" &&
      (entry.filename == "ChessfilesData.json" ||
        entry.filename == "ChessfilesTraining" ||
        entry.filename == "ChessfilesTrainingSettings"
      )
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
    let storedSettings = {}
    try {
      if (await this.storage.local.exists("/ChessfilesTrainingSettings")) {
        const storedJson = await this.storage.local.readFile("/ChessfilesTrainingSettings")
        storedSettings = JSON.parse(storedJson);
      }
    } catch (e) {
      console.warn(`Error loading stored settings: ${e}`)
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
    const metaManager = (await this.metaManager);
    const trainingMetas = metaManager.listTraining();
    const activity = metaManager.listActivity();
    return {
      metas: trainingMetas,
      activity: activity
        .filter((a) => a.type == "training")
        .slice(0, 20),
    };
  }

  async createTraining(bookPath: string): Promise<Training> {
    const book = await this.readBook(bookPath);
    const settings = await this.readTrainingSettings();
    const [storageName] = this.engineForPath(bookPath);
    const trainingDir = `/${storageName}/ChessfilesTraining/`
    const training = Training.create(settings, bookPath, book, trainingDir);

    const metaManager = (await this.metaManager);
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
    const metaManager = (await this.metaManager);
    await this.saveTraining(training);
    await metaManager.saveTrainingMeta(training.meta);
  }

  async removeTraining(meta: TrainingMeta): Promise<void> {
    const metaManager = (await this.metaManager);
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
    const metaManager = (await this.metaManager);
    await this.writeFile(training.meta.trainingBookPath, training.exportPgn());

    if (
      training.activity.correctCount > 0 ||
      training.activity.incorrectCount > 0
    ) {
      metaManager.addActivity(training.activity, training.meta.trainingBookPath);
    }
  }
}
