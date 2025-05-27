import type { ChessfilesStorage, DirEntry, PathComponent } from "~/lib/storage";
import { createStorage, joinPath, pathComponents } from "~/lib/storage";
import * as settings from "~/lib/settings";

import type { Resource } from "solid-js";
import { createMemo, createSignal, createResource } from "solid-js";

/**
 * Library storage, this wraps a `ChessfilesStorage` instance and tracks the current files/directory.
 *
 * The App owns the `LibraryStorage` instance, this way we can persist it across page changes.
 */
export class LibraryStorage {
  dir: () => string;
  dirComponents: () => PathComponent[];
  files: Resource<DirEntry[]>;
  refetchFiles: () => void;
  private setDirPath: (dir: string) => void;
  storage: () => ChessfilesStorage;

  constructor() {
    this.storage = createMemo<ChessfilesStorage>(() =>
      createStorage(settings.storage()),
    );

    [this.dir, this.setDirPath] = createSignal("/");
    this.dirComponents = createMemo(() => pathComponents(this.dir()));
    [this.files, { refetch: this.refetchFiles }] = createResource(
      () => ({ storage: this.storage(), dir: this.dir() }),
      async ({ storage, dir }) => {
        const files = await storage.listDir(dir);
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
}
