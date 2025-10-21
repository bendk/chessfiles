export abstract class ChessfilesStorage {
  abstract listDir(path: string): Promise<DirEntry[]>;
  abstract readFile(path: string): Promise<string>;
  abstract exists(path: string): Promise<boolean>;
  abstract createFile(path: string, content: string): Promise<void>;
  abstract writeFile(path: string, content: string): Promise<void>;
  abstract createDir(path: string): Promise<void>;
  abstract move(from: string, to: string): Promise<void>;
  abstract remove(path: string): Promise<void>;
}

export class FileExistsError extends Error {}
export class TrainingExistsError extends Error {}
// TODO: use this more
export class FileNotFoundError extends Error {}

export type DirEntryType = "engine" | "dir" | "file";

export interface DirEntry {
  filename: string;
  type: DirEntryType;
}

export function joinPath(dir: string, filename: string): string {
  if (filename.startsWith("/")) {
    return filename;
  }
  if (dir.endsWith("/")) {
    return dir + filename;
  } else {
    return `${dir}/${filename}`;
  }
}

export function splitPath(path: string): [string, string] {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash == -1 || path == "/") {
    throw new Error(`getParent(): Invalid path: ${path}`);
  }
  return [
    normalizePath(path.slice(0, lastSlash + 1)),
    normalizePath(path.slice(lastSlash + 1)),
  ];
}

export function filename(path: string): string {
  return splitPath(path)[1];
}

export function normalizePath(path: string): string {
  path = path.replace(/\/+$/, "");
  return path == "" ? "/" : path;
}

export interface PathComponent {
  filename: string;
  path: string;
}

export function pathComponents(path: string): PathComponent[] {
  let current = "";
  const components = [
    {
      filename: "Home",
      path: "/",
    },
  ];
  for (const filename of normalizePath(path).split("/")) {
    if (filename == "") {
      continue;
    }
    current += "/" + filename;
    components.push({ filename, path: current });
  }
  return components;
}
