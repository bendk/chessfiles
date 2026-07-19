import type { ChessfilesStorage, TrainingMetaWithPath } from "./base";
import { filename } from "./base";
import { newLibraryActivity } from "~/lib/activity";
import { fixupLoadedTrainingMeta, trainingMetaEquals } from "~/lib/training";
import type { Activity, TrainingActivity } from "~/lib/activity";
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
  // Map sourceBookPath to the TrainingMeta entries
  trainingMeta: Record<string, TrainingMeta>;
  activity: Activity[];
}

function defaultStorageMeta(): StorageMeta {
  return {
    activity: [],
    trainingMeta: {},
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
    for (const [key, trainingMeta] of Object.entries(meta.trainingMeta)) {
      meta.trainingMeta[key] = fixupLoadedTrainingMeta(trainingMeta);
    }
    const manager = new StorageMetaManager(storageName, storage, meta);
    return manager;
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

  fullPath(path: string): string {
    return `/${this.storageName}${path}`;
  }

  async saveMeta() {
    if (await this.storage.exists(META_PATH)) {
      await this.storage.writeFile(META_PATH, JSON.stringify(this.meta));
    } else {
      await this.storage.createFile(META_PATH, JSON.stringify(this.meta));
    }
  }

  async saveTrainingMeta(
    sourceBookPath: string,
    meta: TrainingMeta | undefined,
  ) {
    if (meta !== undefined) {
      if (
        this.meta.trainingMeta[sourceBookPath] &&
        trainingMetaEquals(meta, this.meta.trainingMeta[sourceBookPath])
      ) {
        return;
      }
      this.meta.trainingMeta[sourceBookPath] = meta;
    } else {
      if (this.meta.trainingMeta[sourceBookPath] === undefined) {
        return;
      }
      delete this.meta.trainingMeta[sourceBookPath];
    }
    await this.saveMeta();
  }

  getTrainingMeta(sourceBookPath: string): TrainingMeta | undefined {
    return this.meta.trainingMeta[this.enginePath(sourceBookPath)];
  }

  addTrainingMeta(sourceBookPath: string, meta: TrainingMeta) {
    this.meta.trainingMeta[this.enginePath(sourceBookPath)] = meta;
  }

  removeTrainingMeta(sourceBookPath: string) {
    delete this.meta.trainingMeta[this.enginePath(sourceBookPath)];
  }

  addActivity(activity: Activity) {
    this.meta.activity.push(activity);
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
    const storageMetaManagers = [];
    for (const [name, storage] of engines) {
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

  async addTrainingActivity(
    activity: TrainingActivity,
    forPath: string,
  ): Promise<void> {
    const storageMetaManager = this.lookupStorageMetaManager(forPath);
    storageMetaManager.addActivity(activity);
    await storageMetaManager.saveMeta();
  }

  async onSaveBook(path: string): Promise<void> {
    const storageMetaManager = this.lookupStorageMetaManager(path);
    storageMetaManager.addActivity(newLibraryActivity(filename(path)));
    await storageMetaManager.saveMeta();
  }

  listTraining(): TrainingMetaWithPath[] {
    const entries = [];
    for (const storageMetaManager of this.storageMetaManagers) {
      for (const [bookPath, meta] of Object.entries(
        storageMetaManager.meta.trainingMeta,
      )) {
        entries.push({
          ...meta,
          bookPath: storageMetaManager.fullPath(bookPath),
        });
      }
    }
    entries.sort((a, b) => b.lastTrained - a.lastTrained);
    return entries;
  }

  getTrainingMeta(sourceBookPath: string): TrainingMeta | undefined {
    const storageMetaManager = this.lookupStorageMetaManager(sourceBookPath);
    return storageMetaManager.getTrainingMeta(sourceBookPath);
  }

  async cacheTrainingMeta(bookPath: string, meta: TrainingMeta | undefined) {
    const storageMetaManager = this.lookupStorageMetaManager(bookPath);
    const engineSourceBookPath = storageMetaManager.enginePath(bookPath);
    await storageMetaManager.saveTrainingMeta(engineSourceBookPath, meta);
  }

  /**
   * Update metadata after files have been deleted
   */
  async onFilesDeleted(paths: string[]): Promise<void> {
    for (const [
      storageMetaManager,
      metaManagerPaths,
    ] of this.lookupStorageMetaManagers(paths)) {
      for (const path of metaManagerPaths) {
        storageMetaManager.removeTrainingMeta(path);
      }
      await storageMetaManager.saveMeta();
    }
  }

  /**
   * Update metadata after files have been copy
   *
   * Inputs an array of [sourcePath, destPath] items.
   */
  async onFilesCopied(paths: [string, string][]): Promise<void> {
    const changed = new Set<StorageMetaManager>();
    const pathMap = new Map(paths);

    for (const [
      storageMetaManager,
      metaManagerPaths,
    ] of this.lookupStorageMetaManagers([...pathMap.keys()])) {
      for (const path of metaManagerPaths) {
        const meta = storageMetaManager.getTrainingMeta(path);
        if (meta === undefined) {
          continue;
        }
        const newPath = pathMap.get(path)!;
        const destStorageMetaManager = this.lookupStorageMetaManager(newPath);

        destStorageMetaManager.addTrainingMeta(newPath, meta);
        changed.add(destStorageMetaManager);
      }
    }

    for (const storageMetaManager of changed) {
      await storageMetaManager.saveMeta();
    }
  }

  /**
   * Update metadata after files have been moved
   *
   * Inputs an array of [sourcePath, destPath] items.
   */
  async onFilesMoved(paths: [string, string][]): Promise<void> {
    const changed = new Set<StorageMetaManager>();
    const pathMap = new Map(paths);

    for (const [
      storageMetaManager,
      metaManagerPaths,
    ] of this.lookupStorageMetaManagers([...pathMap.keys()])) {
      for (const path of metaManagerPaths) {
        const meta = storageMetaManager.getTrainingMeta(path);
        if (meta === undefined) {
          continue;
        }
        const newPath = pathMap.get(path)!;
        const destStorageMetaManager = this.lookupStorageMetaManager(newPath);

        storageMetaManager.removeTrainingMeta(path);
        destStorageMetaManager.addTrainingMeta(newPath, meta);
        changed.add(storageMetaManager);
        changed.add(destStorageMetaManager);
      }
    }

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

  private lookupStorageMetaManagers(
    paths: string[],
  ): Map<StorageMetaManager, string[]> {
    const managerMap = new Map();

    for (const path of paths) {
      const manager = this.lookupStorageMetaManager(path);
      const entry = managerMap.get(manager);
      if (entry) {
        entry.push(path);
      } else {
        managerMap.set(manager, [path]);
      }
    }
    return managerMap;
  }
}
