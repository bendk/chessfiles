import type { MenuItem } from "../Menu";
import type { DirEntry } from "~/lib/storage";
import BookIcon from "lucide-solid/icons/book";
import FolderIcon from "lucide-solid/icons/folder";
import { Table, TableCell, TableMenuCell } from "~/components";
import { Match, Switch } from "solid-js";

export interface BooksListProps {
  files: DirEntry[];
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
    <Table
      each={props.files}
      columns={2}
      menu={menu}
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
            </Switch>
            {item.value.filename}
          </TableCell>
          <TableMenuCell item={item} />
        </>
      )}
    </Table>
  );
}
