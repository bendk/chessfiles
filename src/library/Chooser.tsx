import Book from "lucide-solid/icons/book";
import Folder from "lucide-solid/icons/folder";
import { For, Index, Match, Show, Switch } from "solid-js";
import { Button } from "~/components";
import { AppStorage } from "~/lib/storage";

export interface ChooserProps {
  title: string;
  subtitle?: string;
  storage?: AppStorage;
  onClose?: () => void;
  onSelect: (path: string) => void;
  dirMode?: boolean;
  selectDirText?: string;
  error?: string | undefined;
}

export function Chooser(props: ChooserProps) {
  const storage = props.storage ?? new AppStorage();
  const files = () => {
    return storage.files();
    return storage
      .files()
      ?.filter((e) => !(e.type != "dir" && props.dirMode === true));
  };

  return (
    <div>
      <div class="flex justify-between">
        <h1 class="text-3xl truncate text-ellipsis">{props.title}</h1>
        <Button text="Cancel" onClick={props.onClose} />
      </div>
      <Show when={props.subtitle !== undefined}>
        <h1 class="text-lg truncate text-ellipsis">{props.subtitle}</h1>
      </Show>
      <div class="text-lg mt-8 px-4 py-2 flex bg-sky-400 dark:bg-sky-700 text-zinc-800 dark:text-zinc-300">
        <span class="pr-1">Folder:</span>
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
      <div class="bg-zinc-100 dark:bg-zinc-800 px-2 py-4">
        <div class="min-h-0 overflow-y-auto">
          <ul>
            <For each={files()}>
              {(file) => {
                if (file.type == "file") {
                  return (
                    <li class="hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-sky-600 dark:hover:text-sky-300">
                      <button
                        class="flex gap-2 p-2 cursor-pointer w-full"
                        onClick={() =>
                          props.onSelect(storage.absPath(file.filename))
                        }
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
      </div>
      <div class="flex justify-between items-end pt-4 gap-4">
        <Show when={props.dirMode}>
          <Button
            text={props.selectDirText ?? "Select"}
            onClick={() => props.onSelect(storage.dir())}
          />
        </Show>
        <div class="text-red-500">{props.error}</div>
      </div>
    </div>
  );
}
