import { createSignal, splitProps } from "solid-js";
import type { JSXElement } from "solid-js";
import { For, Index, Match, Show, Switch } from "solid-js";
import EllipsisVertical from "lucide-solid/icons/ellipsis-vertical";
import Grip from "lucide-solid/icons/grip-vertical";
import type { DragEvent } from "@thisbeyond/solid-dnd";
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  SortableProvider,
  createSortable,
  closestCenter,
  transformStyle,
} from "@thisbeyond/solid-dnd";
import type { MenuItem } from "~/components";
import { Menu } from "~/components";

export interface TableProps<T> {
  each: readonly T[];
  idMap?: (item: T) => string;
  columns: number;
  children: (item: TableItem<T>) => JSXElement;
  onReorder?: (item: string, insertAfter: string) => void;
  headers?: string[];
  class?: string;
  growColumn?: number;
  menu?: (value: T) => MenuItem[];
  onMenuSelect?: (value: T, action: string) => void;
  onClick?: (value: T) => void;
}

function itemId<T>(props: TableProps<T>, item: T): string {
  // If the caller doesn't provide `idMap`, we assume the items have an `id` field.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return props.idMap ? props.idMap(item) : (item as any).id;
}

interface ActiveItem {
  type: ActiveItemType;
  id: string;
}

type ActiveItemType = "context" | "reorder";

export function Table<T>(props: TableProps<T>) {
  const [activeItem, setActiveItem] = createSignal<ActiveItem | null>(null);
  const [itemProps] = splitProps(props, ["menu", "onMenuSelect"]);

  let column_css = "grid-template-columns:";
  for (let i = 0; i < props.columns; i++) {
    if (i == (props.growColumn ?? 0)) {
      column_css += " 1fr";
    } else {
      column_css += " auto";
    }
  }

  function onClick(value: T) {
    if (props.onClick) {
      props.onClick(value);
    }
  }

  function onDragStart(e: DragEvent) {
    console.log("onDragStart");
    setActiveItem({
      type: "reorder",
      id: e.draggable.id as string,
    });
  }

  function onDragEnd(e: DragEvent) {
    setActiveItem(null);
    if (!props.onReorder) {
      console.error("onDragEnd: no onReorder field");
      return;
    }
    if (e.draggable && e.droppable) {
      props.onReorder(e.draggable.id as string, e.droppable.id as string);
    }
  }

  const itemList = () => (
    <For each={props.each}>
      {(item, index) => {
        const id = itemId(props, item);
        const activeState = () => {
          const active = activeItem();
          if (active === null) {
            return null;
          }
          return {
            thisItem: active.id == id,
            type: active.type,
          };
        };
        const tableItem: TableItem<T> = {
          value: item,
          index,
          activeState,
          setActive: (type) => setActiveItem(type ? { type, id } : null),
          onClick,
          ...itemProps,
        };
        let sortable;
        if (props.onReorder !== undefined) {
          sortable = createSortable(id);
          tableItem.sortableDragActivators = () => sortable!.dragActivators;
        }
        return (
          <div
            ref={sortable?.ref}
            style={sortable ? transformStyle(sortable.transform) : undefined}
            class={`col-span-${props.columns} grid grid-cols-subgrid group border-zinc-400 dark:border-zinc-600 items-center`}
            classList={{
              "hover:bg-zinc-200 dark:hover:bg-zinc-700":
                !otherItemActive(tableItem),
              "bg-zinc-200 dark:bg-zinc-700": thisItemActive(tableItem),
              "transition-transform delay-20 ease-in-out":
                otherItemActive(tableItem),
              "border-b-1": index() != props.each.length - 1,
            }}
          >
            {props.children(tableItem)}
          </div>
        );
      }}
    </For>
  );

  return (
    <div
      class={`grid w-full border-1 rounded-md border-zinc-400 dark:border-zinc-600 justify-center ${props.class ?? ""}`}
      classList={{
        "cursor-grab": activeItem()?.type == "reorder",
      }}
      style={column_css}
    >
      <Show when={props.headers} keyed>
        {(headers) => (
          <Index each={headers}>
            {(header) => (
              <div class="px-2 py-3 border-b-1 border-zinc-400 dark:border-zinc-600 font-normal text-left">
                {header()}
              </div>
            )}
          </Index>
        )}
      </Show>
      <Switch fallback={itemList()}>
        <Match when={props.onReorder}>
          <DragDropProvider
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            collisionDetector={closestCenter}
          >
            <DragDropSensors />
            <SortableProvider
              ids={props.each.map((item) => itemId(props, item))}
            >
              {itemList()}
            </SortableProvider>
            <DragOverlay>
              <div />
            </DragOverlay>
          </DragDropProvider>
        </Match>
      </Switch>
    </div>
  );
}

export interface TableItem<T> {
  value: T;
  index: () => number;
  activeState: () => TableItemActiveState | null;
  setActive: (type: ActiveItemType | null) => void;
  menu?: (item: T) => MenuItem[];
  onMenuSelect?: (item: T, value: string) => void;
  onClick?: (value: T) => void;
  sortableDragActivators?: () => ReturnType<
    typeof createSortable
  >["dragActivators"];
}

interface TableItemActiveState {
  thisItem: boolean;
  type: ActiveItemType;
}

function thisItemActive<T>(item: TableItem<T>): boolean {
  const activeState = item.activeState();
  return activeState !== null && activeState.thisItem;
}

function otherItemActive<T>(item: TableItem<T>): boolean {
  const activeState = item.activeState();
  return activeState !== null && !activeState.thisItem;
}

export interface TableCellProps<T> {
  item: TableItem<T>;
  children: JSXElement;
  grow?: boolean;
  class?: string;
}

export function TableCell<T>(props: TableCellProps<T>) {
  function maybeWrappedWithButton() {
    if (props.item.onClick === undefined) {
      return (
        <div
          class={`w-full flex text-lg px-2 py-3 ${props.class}`}
          classList={{
            "cursor-grab": props.item.activeState()?.type == "reorder",
          }}
        >
          {props.children}
        </div>
      );
    } else {
      return (
        <button
          class={`text-left w-full py-3 text-lg px-2 ${props.class}`}
          classList={{
            "cursor-pointer hover:text-sky-600 dark:hover:text-sky-300":
              props.item.activeState() === null,
            "cursor-grab": props.item.activeState()?.type == "reorder",
          }}
          onClick={() =>
            props.item.onClick ? props.item.onClick(props.item.value) : null
          }
        >
          {props.children}
        </button>
      );
    }
  }

  function maybeWrappedWithContextMenu() {
    if (props.item.menu === undefined) {
      return maybeWrappedWithButton();
    } else {
      return (
        <Menu
          context
          items={props.item.menu ? props.item.menu(props.item.value) : []}
          onSelect={(value) =>
            props.item.onMenuSelect
              ? props.item.onMenuSelect(props.item.value, value)
              : null
          }
          elt={maybeWrappedWithButton()}
        />
      );
    }
  }

  return (
    <div classList={{ grow: props.grow }}>{maybeWrappedWithContextMenu()}</div>
  );
}

export interface TableMenuCellProps<T> {
  item: TableItem<T>;
}

export function TableMenuCell<T>(props: TableMenuCellProps<T>) {
  return (
    <div
      class="flex justify-center px-2 hover:text-sky-500 dark:hover:text-sky-300"
      classList={{
        "cursor-grab": props.item.activeState()?.type == "reorder",
      }}
    >
      <Show when={props.item.activeState()?.thisItem !== false}>
        <Menu
          elt={<EllipsisVertical size={24} />}
          hover
          items={props.item.menu ? props.item.menu(props.item.value) : []}
          onSelect={(value) =>
            props.item.onMenuSelect
              ? props.item.onMenuSelect(props.item.value, value)
              : null
          }
          onOpenChange={(active) =>
            props.item.setActive(active ? "context" : null)
          }
        />
      </Show>
    </div>
  );
}

export interface TableGripperCellProps<T> {
  item: TableItem<T>;
}

export function TableGripperCell<T>(props: TableGripperCellProps<T>) {
  return (
    <div
      class="opacity-0"
      classList={{
        "group-hover:opacity-100 hover:text-sky-500 dark:hover:text-sky-300 cursor-grab ml-2":
          !otherItemActive(props.item),
        "text-sky-500 dark:text-sky-300": thisItemActive(props.item),
      }}
    >
      <Grip
        {...(props.item.sortableDragActivators
          ? props.item.sortableDragActivators()
          : {})}
      />
    </div>
  );
}
