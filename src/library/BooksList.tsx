import { createSignal, For } from "solid-js";
import {
  DragDropProvider,
  DragDropSensors,
  createDraggable,
  createDroppable,
} from "@thisbeyond/solid-dnd";
import Book from "lucide-solid/icons/book";
import EllipsisVertical from "lucide-solid/icons/ellipsis-vertical";
import Folder from "lucide-solid/icons/folder";
import type { MenuRootProps } from "@ark-ui/solid";
import { Menu } from "@ark-ui/solid";
import type { DirEntry } from "~/lib/storage";

declare module "solid-js" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface Directives {
      draggable: boolean;
      droppable: boolean;
    }
  }
}

export type BooksListAction = "open" | "delete";

function FileMenuItems() {
  return (
    <Menu.Positioner>
      <Menu.Content class="text-zinc-800 dark:text-zinc-300 bg-zinc-900 shadow-md shadow-zinc-800 dark:shadow-zinc-950 outline-0 flex flex-col gap-1">
        <Menu.Item
          value="open"
          class="flex items-center text-lg gap-2 cursor-pointer hover:bg-slate-700 pl-4 pr-16 py-2"
        >
          Open
        </Menu.Item>
        <Menu.Item
          value="delete"
          class="flex items-center text-lg gap-2 cursor-pointer hover:bg-slate-700 pl-4 pr-16 py-2"
        >
          Delete
        </Menu.Item>
      </Menu.Content>
    </Menu.Positioner>
  );
}

function DirMenuItems() {
  return (
    <Menu.Positioner>
      <Menu.Content class="text-zinc-800 dark:text-zinc-300 bg-zinc-900 shadow-md shadow-zinc-800 dark:shadow-zinc-950 outline-0 flex flex-col gap-1">
        <Menu.Item
          value="open"
          class="flex items-center text-lg gap-2 cursor-pointer hover:bg-slate-700 pl-4 pr-16 py-2"
        >
          Open
        </Menu.Item>
        <Menu.Item
          value="delete"
          class="flex items-center text-lg gap-2 cursor-pointer hover:bg-slate-700 pl-4 pr-16 py-2"
        >
          Delete
        </Menu.Item>
      </Menu.Content>
    </Menu.Positioner>
  );
}

export interface BooksListProps {
  files: DirEntry[];
  onDirClick: (entry: DirEntry) => void;
  onFileAction: (entry: DirEntry, action: BooksListAction) => void;
  onFileDrag: (dragFile: string, dropFile: string) => void;
}

export function BooksList(props: BooksListProps) {
  const [currentFile, setCurrentFile] = createSignal<DirEntry>();
  const [currentDropTarget, setCurrentDropTarget] = createSignal<string>();
  const [dragging, setDragging] = createSignal(false);
  const [handleClick, setHandleClick] = createSignal(false);

  return (
    <DragDropProvider
      onDragStart={() => {
        setDragging(true);
        setHandleClick(false);
      }}
      onDragOver={(evt) => {
        if (evt.droppable?.id != evt.draggable.id) {
          setCurrentDropTarget(evt.droppable?.id as string | undefined);
        } else {
          setCurrentDropTarget(undefined);
        }
      }}
      onDragEnd={(evt) => {
        if (evt.droppable) {
          props.onFileDrag(
            evt.draggable.id as string,
            evt.droppable.id as string,
          );
        }
        setCurrentDropTarget(undefined);
        setDragging(false);
      }}
    >
      <DragDropSensors />
      <ul>
        <For each={props.files}>
          {(file) => {
            const menuProps: MenuRootProps = {
              onOpenChange: (details) => {
                setCurrentFile(details.open ? file : undefined);
              },
              onSelect: (item) => {
                props.onFileAction(file, item.value as BooksListAction);
              },
              positioning: { placement: "bottom" },
            };

            // @ts-expect-error implicitly used with the `use` directive
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const draggable = createDraggable(file.filename);

            if (file.type == "file") {
              return (
                <li
                  class="group flex hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  classList={{
                    "hover:bg-zinc-200":
                      !dragging() && currentFile() === undefined,
                    "dark:hover:bg-zinc-700":
                      !dragging() && currentFile() === undefined,
                    "bg-zinc-200": !dragging() && file == currentFile(),
                    "dark:bg-zinc-700": !dragging() && file == currentFile(),
                    "hover:text-sky-600": !dragging(),
                    "dark:hover:text-sky-300": !dragging(),
                  }}
                >
                  <Menu.Root {...menuProps}>
                    <Menu.ContextTrigger class="w-full">
                      <button
                        use:draggable
                        class="draggable touch-none flex items-center gap-2 py-2 text-lg px-2 grow"
                      >
                        <Book />
                        {file.filename}
                      </button>
                    </Menu.ContextTrigger>
                    <FileMenuItems />
                  </Menu.Root>

                  <Menu.Root {...menuProps}>
                    <Menu.Trigger
                      class="px-4 hover:text-sky-600 dark:hover:text-sky-300"
                      classList={{
                        "not-group-hover:hidden": currentFile() === undefined,
                        hidden:
                          dragging() ||
                          (currentFile() !== undefined &&
                            file != currentFile()),
                      }}
                    >
                      <EllipsisVertical />
                    </Menu.Trigger>
                    <FileMenuItems />
                  </Menu.Root>
                </li>
              );
            } else {
              // @ts-expect-error implicitly used with the `use` directive
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const droppable = createDroppable(file.filename);
              return (
                <li
                  class="group flex hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  classList={{
                    "bg-sky-800": currentDropTarget() == file.filename,
                    "hover:bg-zinc-200":
                      !dragging() && currentFile() === undefined,
                    "dark:hover:bg-zinc-700":
                      !dragging() && currentFile() === undefined,
                    "bg-zinc-200": !dragging() && file == currentFile(),
                    "dark:bg-zinc-700": !dragging() && file == currentFile(),
                  }}
                >
                  <Menu.Root {...menuProps}>
                    <Menu.ContextTrigger class="w-full">
                      <button
                        use:droppable
                        use:draggable
                        class="droppable draggable flex items-center gap-2 py-2 text-lg px-2 grow hover:text-sky-600 dark:hover:text-sky-300"
                        onMouseDown={() => setHandleClick(true)}
                        onClick={() => {
                          if (handleClick()) {
                            props.onDirClick(file);
                          }
                        }}
                      >
                        <Folder />
                        {file.filename}
                      </button>
                      <DirMenuItems />
                    </Menu.ContextTrigger>
                  </Menu.Root>
                  <Menu.Root {...menuProps}>
                    <Menu.Trigger
                      class="px-4 hover:text-sky-600 dark:hover:text-sky-300"
                      classList={{
                        "not-group-hover:hidden": currentFile() === undefined,
                        hidden:
                          dragging() ||
                          (currentFile() !== undefined &&
                            file != currentFile()),
                      }}
                    >
                      <EllipsisVertical />
                    </Menu.Trigger>
                    <DirMenuItems />
                  </Menu.Root>
                </li>
              );
            }
          }}
        </For>
      </ul>
    </DragDropProvider>
  );
}
