import { Menu as ArkMenu } from "@ark-ui/solid";
import type { JSXElement } from "solid-js";
import { Index, Show } from "solid-js";

export interface MenuItem {
  icon?: JSXElement;
  text?: string;
  value: string;
  selected?: boolean;
  cssClass?: string;
}

export interface MenuProps {
  items: (MenuItem | undefined)[];
  elt: JSXElement;
  context?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect: (value: string) => void;
  hover?: boolean;
  top?: boolean;
  style?: "nags";
}

export function Menu(props: MenuProps) {
  return (
    <ArkMenu.Root
      onOpenChange={(details) =>
        props.onOpenChange ? props.onOpenChange(details.open) : undefined
      }
      onSelect={(item) => props.onSelect(item.value)}
      positioning={{ placement: props.top ? "top" : "bottom" }}
    >
      <Show
        when={props.context !== true}
        fallback={
          <ArkMenu.ContextTrigger class="w-full">
            {props.elt}
          </ArkMenu.ContextTrigger>
        }
      >
        <ArkMenu.Trigger
          class="cursor-pointer"
          classList={{
            "not-group-hover:hidden": props.hover,
          }}
        >
          {props.elt}
        </ArkMenu.Trigger>
      </Show>
      <ArkMenu.Positioner>
        <ArkMenu.Content
          class="text-zinc-800 dark:text-zinc-300 bg-white dark:bg-zinc-800 border-1 dark:border-zinc-700 shadow-md shadow-zinc-800 dark:shadow-zinc-950 outline-0 flex flex-col"
          classList={{
            grid: props.style == "nags",
            "grid-cols-2": props.style == "nags",
            "grid-rows-8": props.style == "nags",
            "grid-flow-col": props.style == "nags",
          }}
        >
          <Index each={props.items}>
            {(item) => (
              <Show when={item()} keyed>
                {(item) => (
                  <ArkMenu.Item
                    value={item.value}
                    class={`flex items-center text-lg gap-2 cursor-pointer hover:bg-sky-400 hover:text-white dark:hover:bg-sky-700 px-4 py-2 ${item.cssClass ?? ""}`}
                    classList={{
                      "dark:bg-slate-700": item.selected,
                      "bg-slate-500": item.selected,
                      "dark:text-white": item.selected,
                      "text-zinc-100": item.selected,
                    }}
                  >
                    {item.icon}
                    {item.text}
                  </ArkMenu.Item>
                )}
              </Show>
            )}
          </Index>
        </ArkMenu.Content>
      </ArkMenu.Positioner>
    </ArkMenu.Root>
  );
}
