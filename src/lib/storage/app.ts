import type { ChessfilesStorage, DirEntry, PathComponent } from "~/lib/storage";
import { createStorage, joinPath, pathComponents } from "~/lib/storage";
import { Book } from "~/lib/node";
import type { Activity } from "~/lib/activity";
import type { TrainingMeta, TrainingSettings } from "~/lib/training";
import { Training, defaultTrainingSettings } from "~/lib/training";
import * as settings from "~/lib/settings";

import type { Resource } from "solid-js";
import { createMemo, createSignal, createResource } from "solid-js";

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

  async readFile(filename: string): Promise<string> {
    const path = joinPath(this.dir(), filename);
    const storage = this.storage();
    return await storage.readFile(path);
  }

  async writeFile(filename: string, content: string) {
    const path = joinPath(this.dir(), filename);
    const storage = this.storage();
    if (await this.exists(filename)) {
      await storage.writeFile(path, content);
    } else {
      await storage.createFile(path, content);
    }
  }

  async readBook(filename: string): Promise<Book> {
    return Book.import(await this.readFile(filename));
  }

  async writeBook(filename: string, book: Book): Promise<void> {
    await this.writeFile(filename, book.export());
  }

  async exists(filename: string): Promise<boolean> {
    return await this.storage().exists(joinPath(this.dir(), filename));
  }

  async createDir(filename: string) {
    const path = joinPath(this.dir(), filename);
    await this.storage().createDir(path);
  }

  async remove(filename: string) {
    const path = joinPath(this.dir(), filename);
    await this.storage().remove(path);
  }

  async move(
    sourceFilename: string,
    destFilename: string,
    refetch: boolean = true,
  ) {
    const sourcePath = joinPath(this.dir(), sourceFilename);
    const destPath = joinPath(
      joinPath(this.dir(), destFilename),
      sourceFilename,
    );
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

    const training = Training.create(settings, book.id(), book.rootNodes);
    this.updateMeta((meta) => ({
      ...meta,
      trainingMeta: [...meta.trainingMeta, training.meta],
    }));
    this.saveTraining(training);
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
