import BookIcon from "lucide-solid/icons/book";
import Database from "lucide-solid/icons/database";
import FolderIcon from "lucide-solid/icons/folder";
import { Index, Match, Show, Switch } from "solid-js";
import { Button, Table, TableCell } from "~/components";
import type { DirEntry } from "~/lib/storage";
import { AppStorage } from "~/lib/storage";

export interface ChooserProps {
  title: string;
  sources?: DirEntry[];
  subtitle?: string;
  storage: AppStorage;
  onClose?: () => void;
  onSelect: (path: string) => void;
  dirMode?: boolean;
  selectDirText?: string;
  error?: string | undefined;
}

export function Chooser(props: ChooserProps) {
  const storage = props.storage ?? new AppStorage();
  const files = () => {
    return storage
      .files()
      ?.filter(
        (e) => props.dirMode !== true || e.type == "dir" || e.type == "engine",
      );
  };

  const sources = () =>
    props.sources ? props.sources.map((e) => e.filename).join(", ") : null;

  function onClick(item: DirEntry) {
    if (item.type === "file") {
      props.onSelect(props.storage.absPath(item.filename));
    } else {
      storage.setDir(item.filename);
    }
  }

  return (
    <>
      <div class="flex text-3xl px-8 py-2 bg-sky-300 dark:bg-sky-700">
        {props.title}
      </div>
      <div class="flex flex-col grow pt-4 px-8">
        <Show when={sources() != null}>
          <div class="pb-8">
            <h2 class="text-lg text-zinc-400 truncate text-ellipsis">
              Source files
            </h2>
            {sources()}
          </div>
        </Show>

        <Show when={props.subtitle !== undefined}>
          <h2 class="text-lg text-zinc-400 truncate text-ellipsis">
            {props.subtitle}
          </h2>
        </Show>
        <div class="text-lg pt-2 pb-1 flex text-zinc-700 dark:text-zinc-300">
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
        <div class="min-h-0 pb-20 overflow-y-auto">
          <Table
            each={files()}
            columns={1}
            idMap={(item) => item.filename}
            onClick={onClick}
            emptyText="No files"
          >
            {(item) => (
              <>
                <TableCell grow item={item} class="flex items-center gap-2">
                  <Switch>
                    <Match when={item.value.type == "file"}>
                      <BookIcon size={20} />
                    </Match>
                    <Match when={item.value.type == "dir"}>
                      <FolderIcon size={20} />
                    </Match>
                    <Match when={item.value.type == "engine"}>
                      <Database size={20} />
                    </Match>
                  </Switch>
                  {item.value.filename}
                </TableCell>
              </>
            )}
          </Table>
        </div>
        <div class="text-red-500">{props.error}</div>
        <div class="flex justify-between items-end pt-4 gap-4 pb-4">
          <Show when={props.dirMode}>
            <Button
              class="text-xl"
              text={props.selectDirText ?? "Select"}
              onClick={() => props.onSelect(storage.dir())}
              disabled={storage.dir() == "/"}
            />
          </Show>
          <Button class="text-xl" text="Cancel" onClick={props.onClose} />
        </div>
      </div>
    </>
  );
}
