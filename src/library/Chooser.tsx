import Book from "lucide-solid/icons/book";
import Loader from "lucide-solid/icons/loader-2";
import Folder from "lucide-solid/icons/folder";
import { For, Index, Match, Show, Switch } from "solid-js";
import { Button, Dialog } from "~/components";
import { AppStorage } from "~/lib/storage";

export interface ChooserProps {
  title: string;
  onClose: () => void;
  onSelect: (path: string) => void;
  dirMode?: boolean;
  selectDirText?: string;
  error?: string | undefined;
}

export function Chooser(props: ChooserProps) {
  const storage = new AppStorage();
  return (
    <Dialog title={props.title} onClose={props.onClose}>
      <div class="text-lg pb-4 flex">
        <Index each={storage.dirComponents()}>
          {(component, index) => (
            <>
              <Show when={index != 0}>
                <span class="mx-2">/</span>
              </Show>
              <Switch>
                <Match when={index < storage.dirComponents().length - 1}>
                  <button
                    class="hover:text-sky-600 dark:hover:text-sky-300 cursor-pointer"
                    onClick={() => storage.setDir(component().path)}
                  >
                    {component().filename}
                  </button>
                </Match>
                <Match when={index == storage.dirComponents().length - 1}>
                  <span>{component().filename}</span>
                </Match>
              </Switch>
            </>
          )}
        </Index>
      </div>
      <Switch>
        <Match when={storage.files.loading}>
          <Loader class="animate-spin duration-1000" size={32} />
        </Match>
        <Match when={storage.files.error}>
          <div class="text-2xl flex gap-2">Error loading files</div>
        </Match>
        <Match
          when={
            storage.files.state == "ready" &&
            storage.files().length == 0 &&
            storage.dir() == "/"
          }
        >
          <div class="pt-4">
            <h2 class="text-3xl">Welcome to Chess Files</h2>
            <p class="text-lg pt-1">
              Use the "Create Book" button below to start building your library
            </p>
          </div>
        </Match>
        <Match when={storage.files.state == "ready"}>
          <div class="min-h-0 overflow-y-auto">
            <ul>
              <For each={storage.files()}>
                {(file) => {
                  if (file.type == "file") {
                    return (
                      <li class="hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-sky-600 dark:hover:text-sky-300">
                        <button
                          class="flex gap-2 p-2 cursor-pointer w-full"
                          onClick={() => {
                            if (props.dirMode !== true) {
                              props.onSelect(storage.absPath(file.filename));
                            }
                          }}
                        >
                          <Book />
                          {file.filename}
                        </button>
                      </li>
                    );
                  } else {
                    return (
                      <li class="hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-sky-600 dark:hover:text-sky-300">
                        <button
                          class="flex gap-2 p-2 cursor-pointer w-full"
                          onClick={() => storage.setDir(file.filename)}
                        >
                          <Folder />
                          {file.filename}
                        </button>
                      </li>
                    );
                  }
                }}
              </For>
            </ul>
          </div>
        </Match>
      </Switch>
      <div class="flex justify-between items-end pt-4 gap-4">
        <Show when={props.dirMode}>
          <Button
            text={props.selectDirText ?? "Select"}
            onClick={() => props.onSelect(storage.dir())}
          />
        </Show>
        <div class="text-red-500">{props.error}</div>
        <Button text="Cancel" onClick={props.onClose} />
      </div>
    </Dialog>
  );
}
