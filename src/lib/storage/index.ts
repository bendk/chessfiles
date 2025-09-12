export {
  filename,
  joinPath,
  splitPath,
  normalizePath,
  pathComponents,
  type PathComponent,
  FileExistsError,
  FileNotFoundError,
  TrainingExistsError,
  type DirEntry,
} from "./base";
import type { Storage } from "~/lib/settings";
import { ChessfilesStorage } from "./base";
import { ChessfilesStorageDropbox } from "./dropbox";
import { ChessfilesStorageLocal } from "./local";
import { AppStorage } from "./app";
import type { StorageMeta } from "./app";

export {
  ChessfilesStorage,
  ChessfilesStorageDropbox,
  ChessfilesStorageLocal,
  AppStorage,
};
export type { Storage, StorageMeta };

export function createStorage(storage: Storage): ChessfilesStorage {
  if (storage == "browser") {
    return new ChessfilesStorageLocal();
  } else if (storage == "dropbox") {
    return new ChessfilesStorageDropbox();
  }
  throw Error("Invalid storage type");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assertIsStorage(val: any): asserts val is Storage {
  if (val != "browser" && val != "dropbox") {
    throw new Error(`Invalid storage value: ${val}`);
  }
}
