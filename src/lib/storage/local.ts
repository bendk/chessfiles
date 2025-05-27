import type { DirEntry } from "./base";
import { v4 as uuidv4 } from "uuid";
import {
  splitPath,
  normalizePath,
  pathComponents,
  ChessfilesStorage,
  FileExistsError,
} from "./base";

interface DirEntryLocal extends DirEntry {
  id: string;
}

export class ChessfilesStorageLocal extends ChessfilesStorage {
  constructor() {
    super();
    // Ensure the root entry is present
    if (localStorage.getItem("files-root") === null) {
      localStorage.setItem("files-root", JSON.stringify([]));
    }
  }

  private lookup(path: string, expectedType?: string): DirEntryLocal {
    path = normalizePath(path);
    let entry: DirEntryLocal = {
      id: "root",
      filename: "",
      type: "dir",
    };
    for (const c of pathComponents(path).slice(1)) {
      const entries = this.readDirEntry(entry);
      const nextEntry = entries.find((e) => e.filename == c.filename);
      if (nextEntry === undefined) {
        throw new Error(`localStorage.lookup: path does not exist (${path})`);
      }
      entry = nextEntry;
    }
    if (expectedType !== undefined && entry.type != expectedType) {
      throw new Error(
        `localStorage.lookup: path is not a ${expectedType} (${path})`,
      );
    }
    return entry;
  }

  private readEntry(entry: DirEntryLocal): string {
    const key = entryKey(entry);
    const entryData = localStorage.getItem(key);
    if (entryData === null) {
      throw Error(`ChessfilesStorage.readEntry: ${key} is null`);
    }
    return entryData;
  }

  private readDirEntry(entry: DirEntryLocal): DirEntryLocal[] {
    return JSON.parse(this.readEntry(entry));
  }

  async listDir(path: string): Promise<DirEntryLocal[]> {
    const entry = this.lookup(path, "dir");
    return this.readDirEntry(entry);
  }

  async readFile(path: string): Promise<string> {
    const entry = this.lookup(path, "file");
    return this.readEntry(entry);
  }

  async exists(path: string) {
    const [dir, filename] = splitPath(normalizePath(path));
    const dirEntry = this.lookup(dir, "dir");
    const entries = this.readDirEntry(dirEntry);
    return entries.some((e) => e.filename == filename);
  }

  async createFile(path: string, content: string) {
    await this.createEntry(path, "file", content);
  }

  async writeFile(path: string, content: string) {
    const entry = this.lookup(path, "file");
    localStorage.setItem(entryKey(entry), content);
  }

  async createDir(path: string) {
    this.createEntry(path, "dir", JSON.stringify([]));
  }

  async createEntry(path: string, type: "dir" | "file", content: string) {
    const [dir, filename] = splitPath(normalizePath(path));
    const dirEntry = this.lookup(dir, "dir");
    const entries = this.readDirEntry(dirEntry);
    if (entries.some((e) => e.filename == filename)) {
      throw new FileExistsError(
        `localStorage.createFile: path already exists: ${path}`,
      );
    }

    const newEntry: DirEntryLocal = {
      id: uuidv4(),
      filename,
      type,
    };
    localStorage.setItem(entryKey(newEntry), content);
    localStorage.setItem(
      entryKey(dirEntry),
      JSON.stringify([...entries, newEntry]),
    );
  }

  async move(from: string, to: string) {
    const [fromDir, fromFilename] = splitPath(normalizePath(from));
    const fromEntry = this.lookup(fromDir, "dir");
    const fromDirEntries = this.readDirEntry(fromEntry);

    const [toDir, toFilename] = splitPath(normalizePath(to));
    const toEntry = this.lookup(toDir, "dir");
    const toDirEntries = this.readDirEntry(toEntry);

    const fromIndex = fromDirEntries.findIndex(
      (e) => e.filename == fromFilename,
    );
    if (fromIndex == -1) {
      throw new Error(`localStorage.move: from not found ${fromFilename}`);
    }

    if (toDirEntries.some((e) => e.filename == toFilename)) {
      throw new Error(`localStorage.move: to already present: ${to}`);
    }

    toDirEntries.push(...fromDirEntries.splice(fromIndex, 1));
    localStorage.setItem(entryKey(fromEntry), JSON.stringify(fromDirEntries));
    localStorage.setItem(entryKey(toEntry), JSON.stringify(toDirEntries));
  }

  async remove(path: string) {
    const [dir, filename] = splitPath(normalizePath(path));
    this.removeEntryRecursive(this.lookup(path));

    const dirEntry = this.lookup(dir, "dir");
    const entries = this.readDirEntry(dirEntry);
    const newEntries = entries.filter((e) => e.filename != filename);
    localStorage.setItem(entryKey(dirEntry), JSON.stringify(newEntries));
  }

  private removeEntryRecursive(entry: DirEntryLocal) {
    if (entry.type == "dir") {
      for (const childEntry of this.readDirEntry(entry)) {
        this.removeEntryRecursive(childEntry);
      }
    }
    localStorage.removeItem(entryKey(entry));
  }
}

function entryKey(entry: DirEntryLocal): string {
  return `files-${entry.id}`;
}
