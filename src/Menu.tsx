import { Menu as ArkMenu } from "@ark-ui/solid";
import type { JSXElement } from "solid-js";
import { Index, Show } from "solid-js";

export interface MenuItem {
  icon?: JSXElement;
  text?: string;
  value: string;
  selected?: boolean;
}

export interface MenuProps {
  items: MenuItem[];
  elt: JSXElement;
  context?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect: (value: string) => void;
  hover?: boolean;
}

export function Menu(props: MenuProps) {
  return (
    <ArkMenu.Root
      onOpenChange={(details) =>
        props.onOpenChange ? props.onOpenChange(details.open) : undefined
      }
      onSelect={(item) => props.onSelect(item.value)}
      positioning={{ placement: "bottom" }}
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
        <ArkMenu.Content class="bg-zinc-900 shadow-md shadow-zinc-800 dark:shadow-zinc-950 outline-0 flex flex-col gap-1">
          <Index each={props.items}>
            {(item) => (
              <ArkMenu.Item
                value={item().value}
                class="flex items-center text-lg gap-2 cursor-pointer hover:bg-slate-700 pl-4 pr-16 py-2"
                classList={{
                  "bg-slate-700": item().selected,
                }}
              >
                {item().icon}
                {item().text}
              </ArkMenu.Item>
            )}
          </Index>
        </ArkMenu.Content>
      </ArkMenu.Positioner>
    </ArkMenu.Root>
  );
}
