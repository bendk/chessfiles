import { createMemo, createSignal } from "solid-js";
import type { JSXElement } from "solid-js";
import { For, Index, Show } from "solid-js";
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
import type { MenuItem, MenuContext } from "~/components";
import { Menu, MenuTrigger, MenuContextTrigger } from "~/components";

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
  emptyText?: string;
}

function itemId<T>(props: TableProps<T>, item: T): string {
  // If the caller doesn't provide `idMap`, we assume the items have an `id` field.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return props.idMap ? props.idMap(item) : (item as any).id;
}

interface ActiveItem {
  id: string;
  type: "context" | "reorder";
}

export function Table<T>(props: TableProps<T>) {
  const [activeItem, setActiveItem] = createSignal<ActiveItem | null>(null);

  const columnCss = createMemo(() => {
    let css = "grid-template-columns:";
    for (let i = 0; i < props.columns; i++) {
      if (i == (props.growColumn ?? 0)) {
        css += " 1fr";
      } else {
        css += " auto";
      }
    }
    return css;
  });

  function onClick(value: T) {
    if (props.onClick) {
      props.onClick(value);
    }
  }

  function onDragStart(e: DragEvent) {
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

  function itemList(menuContext?: MenuContext) {
    return (
      <Show
        when={props.each.length > 0}
        fallback={<div class="italic px-4 py-4">{props.emptyText}</div>}
      >
        <For each={props.each}>
          {(item, index) => {
            const id = itemId(props, item);
            let menuProps = undefined;
            if (menuContext && props.menu) {
              menuProps = {
                menu: menuContext,
                generateMenu: () => props.menu!(item),
              };
            }
            const tableItem: TableItem<T> = {
              id,
              value: item,
              index,
              activeItem,
              setActiveItem,
              onClick,
              menuProps,
            };
            let sortable;
            if (props.onReorder !== undefined) {
              sortable = createSortable(id);
              tableItem.sortableDragActivators = () => sortable!.dragActivators;
            }
            return (
              <div
                ref={sortable?.ref}
                style={
                  sortable ? transformStyle(sortable.transform) : undefined
                }
                class={`col-span-${props.columns} grid grid-cols-subgrid group border-fg-3 items-center`}
                classList={{
                  "hover-bg": !otherItemActive(tableItem),
                  "bg-highlight-fill": thisItemActive(tableItem),
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
      </Show>
    );
  }

  function itemListWithDragDrop(menu?: MenuContext) {
    if (!props.onReorder) {
      return itemList(menu);
    }
    return (
      <DragDropProvider
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        collisionDetector={closestCenter}
      >
        <DragDropSensors />
        <SortableProvider ids={props.each.map((item) => itemId(props, item))}>
          {itemList(menu)}
        </SortableProvider>
        <DragOverlay>
          <div />
        </DragOverlay>
      </DragDropProvider>
    );
  }

  function itemListWithMenu() {
    if (!props.menu) {
      return itemListWithDragDrop();
    }
    return (
      <Menu
        onOpenChange={(open) => {
          if (!open) {
            setActiveItem(null);
          }
        }}
        onSelect={(action) => {
          const active = activeItem();
          if (active === null || active.type != "context") {
            console.error("invalid active state:", active);
            return;
          }
          if (props.onMenuSelect) {
            for (const item of props.each) {
              if (itemId(props, item) == active.id) {
                props.onMenuSelect(item, action);
                return;
              }
            }
            console.error("can't find active menu item");
          }
        }}
        placement="bottom"
      >
        {(menu) => itemListWithDragDrop(menu)}
      </Menu>
    );
  }

  return (
    <div
      class={`grid w-full border-1 rounded-md border-fg-3 justify-center ${props.class ?? ""}`}
      style={columnCss()}
    >
      <Show when={props.headers} keyed>
        {(headers) => (
          <Index each={headers}>
            {(header) => (
              <div class="px-2 py-3 border-b-1 border-fg-3 font-normal text-left">
                {header()}
              </div>
            )}
          </Index>
        )}
      </Show>
      {itemListWithMenu()}
    </div>
  );
}

export interface TableItem<T> {
  id: string;
  value: T;
  index: () => number;
  activeItem: () => ActiveItem | null;
  setActiveItem: (active: ActiveItem | null) => void;
  onClick?: (value: T) => void;
  sortableDragActivators?: () => ReturnType<
    typeof createSortable
  >["dragActivators"];
  menuProps?: {
    menu: MenuContext;
    generateMenu: () => MenuItem[];
  };
}

function thisItemActive<T>(item: TableItem<T>): boolean {
  const active = item.activeItem();
  return active !== null && active.id == item.id;
}

function otherItemActive<T>(item: TableItem<T>): boolean {
  const active = item.activeItem();
  return active !== null && active.id != item.id;
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
        <div class={`w-full flex text-lg px-2 py-3 ${props.class}`}>
          {props.children}
        </div>
      );
    } else {
      return (
        <button
          class={`text-left w-full py-3 text-lg px-2 ${props.class}`}
          classList={{
            "cursor-pointer": props.item.activeItem() === null,
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
    if (props.item.menuProps === undefined) {
      return maybeWrappedWithButton();
    } else {
      return (
        <MenuContextTrigger
          {...props.item.menuProps}
          onOpen={() =>
            props.item.setActiveItem({
              id: props.item.id,
              type: "context",
            })
          }
        >
          {maybeWrappedWithButton()}
        </MenuContextTrigger>
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
  if (props.item.menuProps === undefined) {
    return <div />;
  }
  return (
    <div class="flex justify-center px-2 hover-fg">
      <Show when={!otherItemActive(props.item)}>
        <MenuTrigger
          hover
          {...props.item.menuProps}
          onOpen={() =>
            props.item.setActiveItem({
              id: props.item.id,
              type: "context",
            })
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
      class="cursor-grab"
      classList={{
        "group-hover:opacity-100 hover-fg ml-2": !otherItemActive(props.item),
        "text-highlight-line opacity-100": thisItemActive(props.item),
        "opacity-0": !thisItemActive(props.item),
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
