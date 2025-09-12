import { createSignal, splitProps } from "solid-js";
import type { JSXElement } from "solid-js";
import { For, Index, Show } from "solid-js";
import EllipsisVertical from "lucide-solid/icons/ellipsis-vertical";
import type { MenuItem } from "~/components";
import { Menu } from "~/components";

export interface TableProps<T> {
  each: readonly T[];
  columns: number;
  children: (item: TableItem<T>) => JSXElement;
  headers?: string[];
  class?: string;
  menu?: (value: T) => MenuItem[];
  onMenuSelect?: (value: T, action: string) => void;
  onClick?: (value: T) => void;
}

export function Table<T>(props: TableProps<T>) {
  const [activeIndex, setActiveIndex] = createSignal(-1);
  const [itemProps] = splitProps(props, ["menu", "onMenuSelect", "onClick"]);

  let column_css = "grid-template-columns: 1fr";
  for (let i = 1; i < props.columns; i++) {
    column_css += " auto";
  }

  return (
    <div
      class={`grid w-full border-1 rounded-md border-zinc-400 dark:border-zinc-600 justify-center ${props.class ?? ""}`}
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
      <For each={props.each}>
        {(item, index) => {
          const isActive = () => activeIndex() == index();
          const tableItem: TableItem<T> = {
            value: item,
            index,
            isActive,
            setActive: (active) => setActiveIndex(active ? index() : -1),
            ...itemProps,
          };
          return (
            <div
              class={`col-span-${props.columns} grid grid-cols-subgrid group border-zinc-400 dark:border-zinc-600 items-center`}
              classList={{
                "hover:bg-zinc-200": !isActive(),
                "dark:hover:bg-zinc-700": !isActive(),
                "bg-zinc-200": isActive(),
                "dark:bg-zinc-700": isActive(),
                "border-b-1": index() != props.each.length - 1,
              }}
            >
              {props.children(tableItem)}
            </div>
          );
        }}
      </For>
    </div>
  );
}

export interface TableItem<T> {
  value: T;
  index: () => number;
  isActive: () => boolean;
  setActive: (active: boolean) => void;
  menu?: (item: T) => MenuItem[];
  onMenuSelect?: (item: T, value: string) => void;
  onClick?: (value: T) => void;
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
          class={`text-left cursor-pointer w-full py-3 text-lg px-2 hover:text-sky-600 dark:hover:text-sky-300 ${props.class}`}
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
    <div class="flex justify-center">
      <Menu
        elt={<EllipsisVertical size={24} />}
        hover={!props.item.isActive()}
        items={props.item.menu ? props.item.menu(props.item.value) : []}
        onSelect={(value) =>
          props.item.onMenuSelect
            ? props.item.onMenuSelect(props.item.value, value)
            : null
        }
        onOpenChange={props.item.setActive}
      />
    </div>
  );
}
