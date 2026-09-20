import type { DirEntry, AppStorage } from "~/lib/storage";
import BookIcon from "lucide-solid/icons/book";
import Database from "lucide-solid/icons/database";
import FolderIcon from "lucide-solid/icons/folder";
import LoaderCircle from "lucide-solid/icons/loader-circle";
import type { MenuItem } from "~/components";
import {
  menuItem,
  Checkbox,
  Table,
  TableCell,
  TableMenuCell,
  TrainingRankIcon,
} from "~/components";
import { Match, Show, Switch } from "solid-js";

export interface BooksListProps {
  storage: AppStorage;
  bulkMode: boolean;
  selectedFiles: Set<DirEntry>;
  setSelectedFiles: (selected: Set<DirEntry>) => void;
  onFileAction: (entry: DirEntry, action: string) => void;
  onClick: (entry: DirEntry) => void;
}

export function BooksList(props: BooksListProps) {
  function menu(value: DirEntry): MenuItem[] {
    if (value.type == "engine") {
      return [menuItem("open", "Open")];
    } else {
      return [
        menuItem("open", "Open"),
        menuItem("rename", "Rename"),
        menuItem("duplicate", "Duplicate"),
        menuItem("copy", "Copy"),
        menuItem("move", "Move"),
        menuItem("delete", "Delete"),
      ];
    }
  }
  return (
    <Switch>
      <Match when={props.storage.loading()}>
        <div class="pl-2">
          <LoaderCircle size={48} class="animate-spin" />
        </div>
      </Match>
      <Match when={true}>
        <Table
          each={props.storage.files()}
          columns={4}
          growColumn={props.bulkMode ? 2 : 1}
          menu={menu}
          idMap={(item) => item.filename}
          onMenuSelect={(entry, action) => props.onFileAction(entry, action)}
          onClick={props.onClick}
          emptyText="No files"
        >
          {(item) => (
            <>
              <Show when={props.bulkMode}>
                <TableCell item={item}>
                  <Checkbox
                    checked={props.selectedFiles.has(item.value)}
                    onChange={(selected) => {
                      const entry = item.value;
                      const files = props.selectedFiles;
                      if (selected) {
                        files.add(entry);
                      } else {
                        files.delete(entry);
                      }
                      props.setSelectedFiles(files);
                    }}
                  />
                </TableCell>
              </Show>
              <TableCell item={item} class="items-center">
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
              </TableCell>
              <TableCell item={item} class="items-center">
                {item.value.filename}
              </TableCell>
              <TableCell item={item}>
                <Show when={item.value.trainingRank !== undefined}>
                  {<TrainingRankIcon rank={item.value.trainingRank ?? 0} />}
                </Show>
              </TableCell>
              <Show when={!props.bulkMode}>
                <TableMenuCell item={item} />
              </Show>
            </>
          )}
        </Table>
      </Match>
    </Switch>
  );
}
