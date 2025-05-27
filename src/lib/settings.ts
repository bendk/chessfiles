import { createSignal } from "solid-js";

export type Storage = "browser" | "dropbox";

const [storage, setStorageSignal] = createSignal<Storage>(
  (localStorage.getItem("settings-storage") ?? "browser") as Storage,
);

export { storage };

export function setStorage(storage: Storage) {
  localStorage.setItem("settings-storage", storage);
  setStorageSignal(storage);
}
