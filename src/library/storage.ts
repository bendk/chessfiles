import type { ChessfilesStorage, DirEntry, PathComponent } from "~/lib/storage";
import {
  joinPath,
  pathComponents,
  ChessfilesStorageLocal,
} from "~/lib/storage";

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
  setStorage: (storage: ChessfilesStorage) => void;
  refetchFiles: () => void;
  private setDirPath: (dir: string) => void;
  private storage: () => ChessfilesStorage;
  private mutateFiles: (mutate: (files: DirEntry[]) => DirEntry[]) => void;

  constructor() {
    [this.storage, this.setStorage] = createSignal(
      new ChessfilesStorageLocal(),
    );
    [this.dir, this.setDirPath] = createSignal("/");
    this.dirComponents = createMemo(() => pathComponents(this.dir()));
    [this.files, { mutate: this.mutateFiles, refetch: this.refetchFiles }] =
      createResource(this.dir, async (dir) => {
        const files = await this.storage().listDir(dir);
        files.sort((a, b) => {
          if (a.type == "dir" && b.type == "file") return -1;
          if (a.type == "file" && b.type == "dir") return 1;
          return a.filename.localeCompare(b.filename);
        });
        return files;
      });
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
      this.mutateFiles((current) => [
        ...current!,
        { filename: filename, type: "file" },
      ]);
    }
  }

  async exists(filename: string): Promise<boolean> {
    return await this.storage().exists(joinPath(this.dir(), filename));
  }

  async createDir(filename: string) {
    const path = joinPath(this.dir(), filename);
    await this.storage().createDir(path);
    this.mutateFiles((current) => [
      ...current!,
      { filename: filename, type: "dir" },
    ]);
  }

  async remove(filename: string) {
    const path = joinPath(this.dir(), filename);
    await this.storage().remove(path);
    this.mutateFiles((current) =>
      current!.filter((f) => f.filename != filename),
    );
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
