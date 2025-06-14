import type { ChessfilesStorage, DirEntry, PathComponent } from "~/lib/storage";
import { createStorage, joinPath, pathComponents } from "~/lib/storage";
import { Book } from "~/lib/node";
import type { Activity } from "~/lib/activity";
import type { TrainingMeta, TrainingSettings } from "~/lib/training";
import { Training, defaultTrainingSettings } from "~/lib/training";
import * as settings from "~/lib/settings";
import { FileExistsError, TrainingExistsError } from "./base";

import type { Resource } from "solid-js";
import {
  createEffect,
  createMemo,
  createSignal,
  createResource,
} from "solid-js";

/**
 * Storage metadata
 *
 * This mostly acts as an index for files.
 * It also stores the training settings.
 */
interface StorageMeta {
  activity: Activity[];
  trainingMeta: TrainingMeta[];
  trainingSettings: TrainingSettings;
}

/**
 * App storage, this presents a high-level interface to a `ChessfilesStorage` instance:
 *
 * - Directory listings are cached
 * - Operates on books/training instances rather than file contents
 * - Is owned by the `App` component and persists across page changes.
 */
export class AppStorage {
  dir: () => string;
  dirComponents: () => PathComponent[];
  files: Resource<DirEntry[]>;
  refetchFiles: () => void;
  private setDirPath: (dir: string) => void;
  storage: () => ChessfilesStorage;
  checkedTrainingDirExists = false;
  cachedMeta?: StorageMeta;

  constructor() {
    this.storage = createMemo<ChessfilesStorage>(() =>
      createStorage(settings.storage()),
    );
    createEffect(() => {
      // Reset these when `this.storage` changes
      this.storage();
      this.cachedMeta = undefined;
      this.checkedTrainingDirExists = false;
    });

    [this.dir, this.setDirPath] = createSignal("/");
    this.dirComponents = createMemo(() => pathComponents(this.dir()));
    [this.files, { refetch: this.refetchFiles }] = createResource(
      () => ({ storage: this.storage(), dir: this.dir() }),
      async ({ storage, dir }) => {
        const files = (await storage.listDir(dir)).filter(
          (entry) => !this.isSpecialFile(dir, entry),
        );
        files.sort((a, b) => {
          if (a.type == "dir" && b.type == "file") return -1;
          if (a.type == "file" && b.type == "dir") return 1;
          return a.filename.localeCompare(b.filename);
        });
        return files;
      },
    );
  }

  setDir(path: string) {
    if (!path.startsWith("/")) {
      path = joinPath(this.dir(), path);
    }
    this.setDirPath(path);
  }

  async readFile(path: string): Promise<string> {
    path = joinPath(this.dir(), path);
    const storage = this.storage();
    return await storage.readFile(path);
  }

  async writeFile(path: string, content: string) {
    path = joinPath(this.dir(), path);
    const storage = this.storage();
    if (await this.exists(path)) {
      await storage.writeFile(path, content);
    } else {
      await storage.createFile(path, content);
    }
  }

  async readBook(path: string): Promise<Book> {
    return Book.import(await this.readFile(path));
  }

  async writeBook(path: string, book: Book): Promise<void> {
    await this.writeFile(path, book.export());
  }

  async exists(path: string): Promise<boolean> {
    return await this.storage().exists(joinPath(this.dir(), path));
  }

  async createDir(path: string) {
    path = joinPath(this.dir(), path);
    await this.storage().createDir(path);
  }

  async remove(path: string) {
    path = joinPath(this.dir(), path);
    await this.storage().remove(path);
  }

  absPath(path: string): string {
    return joinPath(this.dir(), path);
  }

  async move(
    sourceFilename: string,
    destPath: string,
    refetch: boolean = true,
  ) {
    const sourcePath = joinPath(this.dir(), sourceFilename);
    if (await this.storage().exists(destPath)) {
      throw FileExistsError;
    }
    await this.storage().move(sourcePath, destPath);
    if (refetch) {
      this.refetchFiles();
    }
  }

  private isSpecialFile(dir: string, entry: DirEntry): boolean {
    if (
      dir == "/" &&
      (entry.filename == "ChessfilesData.json" ||
        entry.filename == "ChessfilesTraining")
    ) {
      return true;
    }

    return false;
  }

  async readTrainingSettings(): Promise<TrainingSettings> {
    return (await this.getMeta()).trainingSettings;
  }

  async saveTrainingSettings(
    trainingSettings: TrainingSettings,
  ): Promise<void> {
    await this.updateMeta((meta) => ({
      ...meta,
      trainingSettings,
    }));
  }

  async listTraining(): Promise<TrainingMeta[]> {
    const meta = await this.getMeta();
    return meta.trainingMeta;
  }

  async createTraining(bookPath: string): Promise<Training> {
    const book = await this.readBook(bookPath);
    const settings = await this.readTrainingSettings();

    const training = Training.create(settings, bookPath, book);
    const meta = await this.getMeta();
    for (const trainingMeta of meta.trainingMeta) {
      if (trainingMeta.bookId == book.id()) {
        throw new TrainingExistsError();
      }
    }

    await this.updateMeta((meta) => ({
      ...meta,
      trainingMeta: [...meta.trainingMeta, training.meta],
    }));
    await this.saveTraining(training);
    return training;
  }

  async lookupTrainingMeta(bookId: string): Promise<TrainingMeta | null> {
    const meta = await this.getMeta();
    for (const trainingMeta of meta.trainingMeta) {
      if (trainingMeta.bookId == bookId) {
        return trainingMeta;
      }
    }
    return null;
  }

  async loadTraining(meta: TrainingMeta): Promise<Training> {
    const settings = await this.readTrainingSettings();
    const pgnData = await this.readFile(await this.trainingPath(meta));
    return Training.import(pgnData, settings);
  }

  async updateTraining(training: Training): Promise<void> {
    await this.saveTraining(training);
    await this.updateMeta((meta) => ({
      ...meta,
      trainingMeta: [...meta.trainingMeta, training.meta],
    }));
  }

  async removeTraining(meta: TrainingMeta): Promise<void> {
    await this.remove(await this.trainingPath(meta));
    await this.updateMeta((meta) => ({
      ...meta,
      trainingMeta: meta.trainingMeta.filter(
        (meta) => meta.bookId != meta.bookId,
      ),
    }));
  }

  private async trainingPath(meta: TrainingMeta): Promise<string> {
    const filename = `${meta.bookId}.json`;
    if (!this.checkedTrainingDirExists) {
      if (!(await this.exists("ChessfilesTraining"))) {
        await this.createDir("ChessfilesTraining");
      }
      this.checkedTrainingDirExists = true;
    }
    return joinPath("ChessfilesTraining", filename);
  }

  private async saveTraining(training: Training): Promise<void> {
    const path = await this.trainingPath(training.meta);
    await this.writeFile(path, training.export());
    if (
      training.activity.correctCount > 0 ||
      training.activity.incorrectCount > 0
    ) {
      this.updateMeta((meta) => ({
        ...meta,
        activity: [training.activity, ...meta.activity],
      }));
    }
  }

  private async getMeta(): Promise<StorageMeta> {
    if (this.cachedMeta === undefined) {
      const path = "/ChessfilesData.json";
      if (await this.exists(path)) {
        const data = await this.readFile(path);
        this.cachedMeta = JSON.parse(data) as StorageMeta;
      } else {
        this.cachedMeta = {
          activity: [],
          trainingMeta: [],
          trainingSettings: defaultTrainingSettings(),
        };
      }
    }
    return this.cachedMeta;
  }

  private async setMeta(meta: StorageMeta): Promise<void> {
    this.cachedMeta = meta;
    const path = "/ChessfilesData.json";
    const data = JSON.stringify(meta);
    await this.writeFile(path, data);
  }

  private async updateMeta(
    update: (meta: StorageMeta) => StorageMeta,
  ): Promise<void> {
    const meta = await this.getMeta();
    await this.setMeta(update(meta));
  }
}
