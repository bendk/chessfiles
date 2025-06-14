import { Menu as ArkMenu } from "@ark-ui/solid";
import type { JSXElement } from "solid-js";
import { Index, Match, Show, Switch } from "solid-js";

export interface MenuItem {
  icon?: JSXElement;
  text?: string;
  value: string;
  disabled?: boolean;
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
              <Switch>
                <Match when={item()} keyed>
                  {(item) => (
                    <ArkMenu.Item
                      value={item.value}
                      disabled={item.disabled}
                      class={`flex items-center cursor-pointer text-lg gap-2 px-4 py-2 ${item.cssClass ?? ""}`}
                      classList={{
                        "dark:bg-slate-700": item.selected,
                        "bg-slate-500": item.selected,
                        "text-zinc-100":
                          item.selected && item.disabled !== true,
                        "text-zinc-500": item.disabled === true,
                        "dark:text-white":
                          item.selected && item.disabled !== true,
                        "hover:bg-sky-400": item.disabled !== true,
                        "hover:text-white": item.disabled !== true,
                        "dark:hover:bg-sky-700": item.disabled !== true,
                      }}
                    >
                      {item.icon}
                      {item.text}
                    </ArkMenu.Item>
                  )}
                </Match>
                <Match when={item() === undefined}>
                  <div class="h-px bg-zinc-500"></div>
                </Match>
              </Switch>
            )}
          </Index>
        </ArkMenu.Content>
      </ArkMenu.Positioner>
    </ArkMenu.Root>
  );
}
