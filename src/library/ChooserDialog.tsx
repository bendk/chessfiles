import BookIcon from "lucide-solid/icons/book";
import Database from "lucide-solid/icons/database";
import FolderIcon from "lucide-solid/icons/folder";
import FolderTree from "lucide-solid/icons/folder-tree";
import { Index, Match, Show, Switch } from "solid-js";
import { Dialog, Table, TableCell } from "~/components";
import type { DirEntry } from "~/lib/storage";
import { AppStorage } from "~/lib/storage";

export interface ChooserDialogProps {
  title: string;
  sources?: DirEntry[];
  subtitle?: string;
  storage: AppStorage;
  onClose?: () => void;
  onSelect: (path: string) => void;
  dirMode?: boolean;
  validate?: (path: string) => boolean;
  selectDirText?: string;
  error?: string | undefined;
}

export function ChooserDialog(props: ChooserDialogProps) {
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
      props.onSelect(storage.absPath(item.filename));
    } else {
      storage.setDir(item.filename);
    }
  }

  return (
    <Dialog
      title={props.title}
      submitText={props.dirMode ? "Select" : undefined}
      onSubmit={
        props.onSelect ? () => props.onSelect(storage.dir()) : undefined
      }
      disabled={props.validate?.(storage.dir()) === false}
      closeText="Cancel"
      onClose={props.onClose}
    >
      <Show when={sources() != null}>
        <div class="pb-8">
          <h2 class="text-lg text-fg-2 truncate text-ellipsis">Source files</h2>
          {sources()}
        </div>
      </Show>

      <Show when={props.subtitle !== undefined}>
        <h2 class="text-lg text-fg-2 truncate text-ellipsis">
          {props.subtitle}
        </h2>
      </Show>
      <div class="text-lg pt-2 pb-2 flex items-center text-fg-1">
        <Index each={storage.dirComponents()}>
          {(component, index) => (
            <>
              <Show when={index != 0}>
                <span class="mx-2">/</span>
              </Show>
              <Switch>
                <Match when={index < storage.dirComponents().length - 1}>
                  <button
                    class="cursor-pointer hover:text-highlight-1"
                    onClick={() => storage.setDir(component().path)}
                  >
                    <Show when={index > 0} fallback={<FolderTree />}>
                      {component().filename}
                    </Show>
                  </button>
                </Match>
                <Match when={index == storage.dirComponents().length - 1}>
                  <Show when={index > 0} fallback={<FolderTree />}>
                    {component().filename}
                  </Show>
                </Match>
              </Switch>
            </>
          )}
        </Index>
      </div>
      <div class="min-h-0 pb-4 basis-0 grow flex gap-10">
        <div class="min-h-0 grow overflow-y-auto">
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
      </div>
      <Show when={props.error}>
        <div class="text-error">{props.error}</div>
      </Show>
    </Dialog>
  );
}
