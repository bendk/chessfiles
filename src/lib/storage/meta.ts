import type { ChessfilesStorage } from "./base";
import { filename } from "./base";
import type { Activity } from "~/lib/activity";
import type { TrainingMeta } from "~/lib/training";

const META_PATH = "/ChessfilesData.json";

/**
 * Manage storage metadata
 *
 * This class manages the `/ChessfilesData.json` file that exists on each user's storage engine.
 * It handles:
 *
 * - Merging the activity together into a single list
 * - Keeping the `TrainingMeta` data in sync with the stored training files
 * - Moving stored training files so they're always on the same storage as their metadata
 */
export interface StorageMeta {
  trainingMeta: TrainingMeta[];
  activity: Activity[];
}

function defaultStorageMeta(): StorageMeta {
  return {
    activity: [],
    trainingMeta: [],
  };
}

/**
 * Manage metadata for a single storage engine
 */
class StorageMetaManager {
  constructor(
    public storageName: string,
    private storage: ChessfilesStorage,
    public meta: StorageMeta,
  ) {}

  static async load(
    storageName: string,
    storage: ChessfilesStorage,
  ): Promise<StorageMetaManager> {
    let meta = defaultStorageMeta();
    if (await storage.exists(META_PATH)) {
      const content = await storage.readFile(META_PATH);
      try {
        meta = {
          ...meta,
          ...JSON.parse(content),
        };
      } catch (e) {
        console.warn(`Error reading ${storageName} meta: ${e}`);
      }
    }
    const manager = new StorageMetaManager(storageName, storage, meta);
    await manager.onLoad();
    return manager;
  }

  /**
   * Perform first-load actions
   */
  private async onLoad() {
    if (!(await this.storage.exists("/ChessfilesTraining"))) {
      await this.storage.createDir("/ChessfilesTraining");
    }
    const trainingFiles = await this.storage.listDir("/ChessfilesTraining");
    const trainingFilePaths = new Set(
      trainingFiles.map(
        (e) => `/${this.storageName}/ChessfilesTraining/${e.filename}`,
      ),
    );
    const metaFilePaths = new Set(
      this.meta.trainingMeta.map((m) => m.trainingBookPath),
    );

    // Remove files in `ChessfilesTraining` with no corresponding metadata
    for (const path of trainingFilePaths) {
      if (!metaFilePaths.has(path)) {
        await this.storage.remove(path.slice(this.storageName.length + 1));
      }
    }

    // Remove metadata entry with no corresponding file in `ChessfilesTraining`
    const filteredTrainingMeta = this.meta.trainingMeta.filter((m) =>
      trainingFilePaths.has(m.trainingBookPath),
    );
    if (filteredTrainingMeta.length != this.meta.trainingMeta.length) {
      this.meta.trainingMeta = filteredTrainingMeta;
      await this.saveMeta();
    }
  }

  matchesPath(path: string): boolean {
    return path.startsWith(`/${this.storageName}/`);
  }

  enginePath(path: string): string {
    if (path.startsWith(`/${this.storageName}/`)) {
      return path.slice(this.storageName.length + 1);
    }
    throw Error(
      `StorageMetaManager.enginePath: path not for my storage engine (${path}, ${this.storageName})`,
    );
  }

  async saveMeta() {
    if (await this.storage.exists(META_PATH)) {
      await this.storage.writeFile(META_PATH, JSON.stringify(this.meta));
    } else {
      await this.storage.createFile(META_PATH, JSON.stringify(this.meta));
    }
  }

  /**
   * Add training TrainingMeta items to our list
   *
   * Does not call `saveMeta()`
   */
  addTrainingMetas(metas: TrainingMeta[]) {
    const trainingBookPaths = new Set(metas.map((m) => m.trainingBookPath));
    this.meta.trainingMeta = [
      ...this.meta.trainingMeta.filter(
        (m) => !trainingBookPaths.has(m.trainingBookPath),
      ),
      ...metas,
    ];
  }

  async saveTrainingMeta(meta: TrainingMeta): Promise<void> {
    this.addTrainingMetas([meta]);
    await this.saveMeta();
  }

  async removeTrainingMeta(meta: TrainingMeta): Promise<void> {
    this.meta.trainingMeta = this.meta.trainingMeta.filter(
      (m) => m.trainingBookPath != meta.trainingBookPath,
    );
    await this.saveMeta();
    const enginePath = this.enginePath(meta.trainingBookPath);
    if (await this.storage.exists(enginePath)) {
      await this.storage.remove(enginePath);
    }
  }

  async addActivity(activity: Activity): Promise<void> {
    this.meta.activity.push(activity);
    await this.saveMeta();
  }

  /**
   * Remove any training metas that match a set of paths
   *
   * Returns the list of removed metas
   *
   * Does not call `saveMeta()`, the AppMetaManager is responsible for that.
   */
  removeMatchingMetas(paths: Set<string>): TrainingMeta[] {
    const removed: TrainingMeta[] = [];
    this.meta.trainingMeta = this.meta.trainingMeta.filter((m) => {
      if (!paths.has(m.sourceBookPath)) {
        return true;
      } else {
        removed.push(m);
        return false;
      }
    });
    return removed;
  }

  async readFile(path: string): Promise<string> {
    return await this.storage.readFile(this.enginePath(path));
  }

  async createFile(path: string, content: string): Promise<void> {
    await this.storage.createFile(this.enginePath(path), content);
  }

  async remove(path: string): Promise<void> {
    await this.storage.remove(this.enginePath(path));
  }
}

/**
 * Manage the metadata for the entire application
 */
export class AppMetaManager {
  private constructor(private storageMetaManagers: StorageMetaManager[]) {}

  static async load(
    engines: [string, ChessfilesStorage][],
  ): Promise<AppMetaManager> {
    const enginesWithMeta = [];
    const storageMetaManagers = [];
    for (const [name, storage] of engines) {
      let meta = defaultStorageMeta();
      if (await storage.exists(META_PATH)) {
        const content = await storage.readFile(META_PATH);
        try {
          meta = {
            ...meta,
            ...JSON.parse(content),
          };
        } catch (e) {
          console.warn(`Error reading ${name} meta: ${e}`);
        }
      }
      enginesWithMeta.push({ name, storage, meta });
      storageMetaManagers.push(await StorageMetaManager.load(name, storage));
    }
    return new AppMetaManager(storageMetaManagers);
  }

  async updateStorageEngines(
    engines: [string, ChessfilesStorage][],
  ): Promise<void> {
    const engineSet = new Map(engines);
    const updatedStorageMetaManagers = this.storageMetaManagers.filter(
      (storageMetaManager) => {
        if (engineSet.has(storageMetaManager.storageName)) {
          engineSet.delete(storageMetaManager.storageName);
          return true;
        } else {
          return false;
        }
      },
    );
    for (const [name, storage] of engineSet) {
      updatedStorageMetaManagers.push(
        await StorageMetaManager.load(name, storage),
      );
    }
    this.storageMetaManagers = updatedStorageMetaManagers;
  }

  listActivity(): Activity[] {
    const activity = [];
    for (const em of this.storageMetaManagers) {
      activity.push(...em.meta.activity);
    }
    activity.sort((a, b) => b.timestamp - a.timestamp);
    return activity;
  }

  async addActivity(activity: Activity, forPath: string): Promise<void> {
    const storageMetaManager = this.lookupStorageMetaManager(forPath);
    await storageMetaManager.addActivity(activity);
  }

  listTraining(): TrainingMeta[] {
    const metas = [];
    for (const storageMetaManagers of this.storageMetaManagers) {
      metas.push(...storageMetaManagers.meta.trainingMeta);
    }
    metas.sort((a, b) => b.lastTrained - a.lastTrained);
    return metas;
  }

  async saveTrainingMeta(meta: TrainingMeta): Promise<void> {
    const storageMetaManager = this.lookupStorageMetaManager(
      meta.trainingBookPath,
    );
    await storageMetaManager.saveTrainingMeta(meta);
  }

  async removeTrainingMeta(meta: TrainingMeta): Promise<void> {
    const storageMetaManager = this.lookupStorageMetaManager(
      meta.trainingBookPath,
    );
    await storageMetaManager.removeTrainingMeta(meta);
  }

  /**
   * Update metadata after files have been deleted
   */
  async onFilesDeleted(paths: string[]): Promise<void> {
    const pathSet = new Set(paths);

    for (const storageMetaManager of this.storageMetaManagers) {
      const removed = storageMetaManager.removeMatchingMetas(pathSet);
      if (removed.length > 0) {
        storageMetaManager.saveMeta();
      }
    }
  }

  /**
   * Update metadata after files have been moved
   *
   * Inputs an array of [sourcePath, destPath] items.
   */
  async onFilesMoved(paths: [string, string][]): Promise<void> {
    const pathMap = new Map(paths);
    const sourcePathSet = new Set(pathMap.keys());

    // For each TrainingMeta that corresponds to a moved path, track:
    //   - the source StorageMetaManager
    //   - the dest StorageMetaManager
    //   - the TrainingMeta itself
    const moved: [StorageMetaManager, StorageMetaManager, TrainingMeta][] = [];

    // Remove TrainingMetas and push changes to the moved array
    for (const storageMetaManager of this.storageMetaManagers) {
      const removed = storageMetaManager.removeMatchingMetas(sourcePathSet);
      for (const meta of removed) {
        const newPath = pathMap.get(meta.sourceBookPath)!;
        const destStorageMetaManager = this.lookupStorageMetaManager(newPath);
        moved.push([storageMetaManager, destStorageMetaManager, meta]);
      }
    }

    // Update TrainingMeta paths and add them to their new storage
    for (const [source, dest, meta] of moved) {
      const newSourceBookPath = pathMap.get(meta.sourceBookPath)!;
      // If the book moved to a new storage, move the training book as well
      if (source !== dest) {
        const content = await source.readFile(meta.trainingBookPath);
        const newTrainingBookPath = `/${dest.storageName}/ChessfilesTraining/${filename(meta.trainingBookPath)}`;
        await dest.createFile(newTrainingBookPath, content);
        await source.remove(meta.trainingBookPath);
        meta.trainingBookPath = newTrainingBookPath;
      }
      meta.sourceBookPath = newSourceBookPath;
      dest.meta.trainingMeta.push(meta);
    }

    // Save all metas
    const changed = new Set(moved.flatMap(([source, dest]) => [source, dest]));
    for (const storageMetaManager of changed) {
      await storageMetaManager.saveMeta();
    }
  }

  private lookupStorageMetaManager(path: string): StorageMetaManager {
    for (const storageMetaManager of this.storageMetaManagers) {
      if (storageMetaManager.matchesPath(path)) {
        return storageMetaManager;
      }
    }
    throw Error(`no StorageMetaManager found for ${path}`);
  }
}
