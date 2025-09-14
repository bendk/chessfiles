import type { ChessfilesStorage, DirEntry, PathComponent } from "~/lib/storage";
import { createStorage, joinPath, pathComponents } from "~/lib/storage";
import { Book } from "~/lib/node";
import type { TrainingActivity } from "~/lib/activity";
import { StatusTracker } from "~/components";
import type { TrainingMeta, TrainingSettings } from "~/lib/training";
import { Training, defaultTrainingSettings } from "~/lib/training";
import * as settings from "~/lib/settings";
import {
  FileExistsError,
  FileNotFoundError,
  TrainingExistsError,
} from "./base";

import { createEffect, createMemo, createSignal } from "solid-js";

/**
 * Storage metadata
 *
 * This mostly acts as an index for files.
 * It also stores the training settings.
 */
export interface StorageMeta {
  trainingMeta: TrainingMeta[];
  trainingActivity: TrainingActivity[];
  trainingSettings: TrainingSettings;
}

export interface TrainingListing {
  metas: TrainingMeta[];
  activity: TrainingActivity[];
}

function defaultStorageMeta(): StorageMeta {
  return {
    trainingActivity: [],
    trainingMeta: [],
    trainingSettings: defaultTrainingSettings(),
  };
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
  status: StatusTracker;
  files: () => DirEntry[] | undefined;
  loading: () => boolean;
  private setFiles: (files: DirEntry[] | undefined) => void;
  private setDirPath: (dir: string) => void;
  private setLoading: (loading: boolean) => void;
  storage: () => ChessfilesStorage;
  checkedTrainingDirExists = false;
  cachedMeta?: StorageMeta;

  constructor(storage?: () => ChessfilesStorage) {
    this.storage =
      storage ??
      createMemo<ChessfilesStorage>(() => createStorage(settings.storage()));
    this.status = new StatusTracker();
    [this.dir, this.setDirPath] = createSignal("/");
    this.dirComponents = createMemo(() => pathComponents(this.dir()));
    [this.files, this.setFiles] = createSignal(undefined);
    [this.loading, this.setLoading] = createSignal(false);

    createEffect(() => {
      this.doRefetchFiles(this.dir(), this.storage());
    });

    createEffect(() => {
      // Call `storage()` so that this runs when `this.storage` changes.
      this.storage();
      // ...and reset these properties
      this.cachedMeta = undefined;
      this.checkedTrainingDirExists = false;
      this.setDir("/");
    });
  }

  clone(): AppStorage {
    return new AppStorage(this.storage);
  }

  refreshAfterImport() {
    this.cachedMeta = undefined;
    this.checkedTrainingDirExists = false;
    this.refetchFiles();
  }

  refetchFiles() {
    this.doRefetchFiles(this.dir(), this.storage());
  }

  private async doRefetchFiles(dir: string, storage: ChessfilesStorage) {
    this.setLoading(true);
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
    const defaultSettings = {
      shuffle: true,
      skipAfter: 2,
      moveDelay: 0.5,
    };
    return {
      ...defaultSettings,
      ...(await this.getMeta()).trainingSettings,
    };
  }

  async saveTrainingSettings(
    trainingSettings: TrainingSettings,
  ): Promise<void> {
    await this.updateMeta((meta) => ({
      ...meta,
      trainingSettings,
    }));
  }

  async listTraining(): Promise<TrainingListing> {
    try {
      const meta = await this.getMeta();
      await this.ensureTrainingUpToDate(meta);
      return {
        metas: meta.trainingMeta,
        activity: meta.trainingActivity.slice(0, 20),
      };
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  private async ensureTrainingUpToDate(meta: StorageMeta) {
    if (!(await this.storage().exists("/ChessfilesTraining"))) {
      return;
    }
    const storageEntries = await this.storage().listDir("/ChessfilesTraining");
    if (await this.isTrainingUpToDate(meta, storageEntries)) {
      return;
    }

    const trainingMeta = [];
    for (const e of storageEntries) {
      const data = await this.readFile(
        joinPath("/ChessfilesTraining", e.filename),
      );
      trainingMeta.push(Training.parseMeta(data));
    }
    meta.trainingMeta = trainingMeta;
    this.setMeta(meta);
  }

  private async isTrainingUpToDate(
    meta: StorageMeta,
    storageEntries: DirEntry[],
  ): Promise<boolean> {
    const metaItems = new Set(meta.trainingMeta.map((m) => m.bookId));
    for (const e of storageEntries) {
      const bookId = e.filename.replace(/.json$/, "");
      if (!metaItems.delete(bookId)) {
        return false;
      }
    }
    return metaItems.size == 0;
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
      trainingMeta: [
        ...meta.trainingMeta.filter(
          (meta) => meta.bookId != training.meta.bookId,
        ),
        training.meta,
      ],
    }));
  }

  async removeTraining(meta: TrainingMeta): Promise<void> {
    await this.remove(await this.trainingPath(meta));
    await this.updateMeta((storageMeta) => ({
      ...storageMeta,
      trainingMeta: storageMeta.trainingMeta.filter(
        (m) => m.bookId != meta.bookId,
      ),
    }));
  }

  async restartTraining(meta: TrainingMeta): Promise<Training> {
    const training = await this.loadTraining(meta);
    if (!(await this.exists(meta.bookPath))) {
      throw new FileNotFoundError();
    }
    const book = await this.readBook(meta.bookPath);
    const updated = training.restart(book);
    await this.updateTraining(updated);
    return updated;
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
      this.updateMeta((meta) => {
        // We're either adding a new activity or updating the last.
        if (training.activity.id == meta.trainingActivity.at(-1)?.id) {
          meta.trainingActivity.splice(-1, 1, training.activity);
        } else {
          meta.trainingActivity.push(training.activity);
        }

        return meta;
      });
    }
  }

  private async getMeta(): Promise<StorageMeta> {
    if (this.cachedMeta === undefined) {
      const path = "/ChessfilesData.json";
      if (await this.exists(path)) {
        try {
          const data = await this.readFile(path);
          this.cachedMeta = {
            ...defaultStorageMeta(),
            ...(JSON.parse(data) as StorageMeta),
          };
        } catch (e) {
          console.error("Error reading meta", e);
          this.cachedMeta = defaultStorageMeta();
          this.setMeta(defaultStorageMeta());
        }
      } else {
        this.cachedMeta = defaultStorageMeta();
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
