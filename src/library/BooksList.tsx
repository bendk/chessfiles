import type { MenuItem } from "../Menu";
import type { DirEntry, AppStorage } from "~/lib/storage";
import BookIcon from "lucide-solid/icons/book";
import Database from "lucide-solid/icons/database";
import FolderIcon from "lucide-solid/icons/folder";
import LoaderCircle from "lucide-solid/icons/loader-circle";
import { Table, TableCell, TableMenuCell } from "~/components";
import { Match, Switch } from "solid-js";

export interface BooksListProps {
  storage: AppStorage;
  onFileAction: (entry: DirEntry, action: string) => void;
}

export function BooksList(props: BooksListProps) {
  function menu(): MenuItem[] {
    return [
      {
        value: "open",
        text: "Open",
      },
      {
        value: "move",
        text: "Move",
      },
      {
        value: "delete",
        text: "Delete",
      },
    ];
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
          columns={2}
          menu={menu}
          idMap={(item) => item.filename}
          onMenuSelect={(entry, action) => props.onFileAction(entry, action)}
          onClick={(entry) => props.onFileAction(entry, "open")}
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
              <TableMenuCell item={item} />
            </>
          )}
        </Table>
      </Match>
    </Switch>
  );
}
