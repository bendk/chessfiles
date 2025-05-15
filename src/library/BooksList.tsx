import { createSignal, For, Show } from "solid-js";
import {
  DragDropProvider,
  DragDropSensors,
  createDraggable,
  createDroppable,
} from "@thisbeyond/solid-dnd";
import Book from "lucide-solid/icons/book";
import EllipsisVertical from "lucide-solid/icons/ellipsis-vertical";
import Folder from "lucide-solid/icons/folder";
import type { MenuItem } from "../Menu";
import { Menu } from "../Menu";
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

function fileMenuItems(): MenuItem[] {
  return [
    {
      value: "open",
      text: "Open",
    },
    {
      value: "delete",
      text: "Delete",
    },
  ];
}

function dirMenuItems(): MenuItem[] {
  return [
    {
      value: "open",
      text: "Open",
    },
    {
      value: "delete",
      text: "Delete",
    },
  ];
}

export interface BooksListProps {
  files: DirEntry[];
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
        if (evt.droppable && evt.droppable?.id != evt.draggable.id) {
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
            const sharedMenuProps = {
              onOpenChange: (open: boolean) => {
                setCurrentFile(open ? file : undefined);
              },
              onSelect: (value: string) => {
                props.onFileAction(file, value as BooksListAction);
              },
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
                  <Menu
                    elt={
                      <button
                        use:draggable
                        class="draggable cursor-pointer w-full touch-none flex items-center gap-2 py-2 text-lg px-2 grow"
                        onMouseDown={() => setHandleClick(true)}
                        onClick={() => {
                          if (handleClick()) {
                            props.onFileAction(file, "open");
                          }
                        }}
                      >
                        <Book />
                        {file.filename}
                      </button>
                    }
                    context
                    items={dirMenuItems()}
                    {...sharedMenuProps}
                  />
                  <Menu
                    elt={<EllipsisVertical />}
                    hover
                    items={dirMenuItems()}
                    {...sharedMenuProps}
                  />
                </li>
              );
            } else {
              // @ts-expect-error implicitly used with the `use` directive
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const droppable = createDroppable(file.filename);
              return (
                <li
                  class="group flex"
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
                  <Menu
                    elt={
                      <button
                        use:droppable
                        use:draggable
                        class="droppable w-full cursor-pointer draggable flex items-center gap-2 py-2 text-lg px-2"
                        onMouseDown={() => setHandleClick(true)}
                        onClick={() => {
                          if (handleClick()) {
                            props.onFileAction(file, "open");
                          }
                        }}
                      >
                        <Folder />
                        {file.filename}
                      </button>
                    }
                    context
                    items={fileMenuItems()}
                    {...sharedMenuProps}
                  />
                  <Show when={!dragging()}>
                    <Menu
                      elt={<EllipsisVertical />}
                      hover={file != currentFile()}
                      items={fileMenuItems()}
                      {...sharedMenuProps}
                    />
                  </Show>
                </li>
              );
            }
          }}
        </For>
      </ul>
    </DragDropProvider>
  );
}
