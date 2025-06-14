import type { MenuItem } from "../Menu";
import type { DirEntry } from "~/lib/storage";
import { Table, TableCell, TableMenuCell } from "~/components";

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
            {item.value.filename}
          </TableCell>
          <TableMenuCell item={item} />
        </>
      )}
    </Table>
  );
}
