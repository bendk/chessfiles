import { Menu as ArkMenu } from "@ark-ui/solid";
import type { JSXElement } from "solid-js";
import { createMemo, splitProps, Index, Match, Show, Switch } from "solid-js";
import { buttonClass } from "./Button";

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
  class?: string;
  textSize?: string;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect: (value: string) => void;
  hover?: boolean;
  placement?:
    | "top"
    | "bottom"
    | "top-start"
    | "top-end"
    | "bottom-start"
    | "bottom-end";
  sameWidth?: boolean;
  style?: "nags";
}

export function Menu(props: MenuProps) {
  return (
    <ArkMenu.Root
      onOpenChange={(details) =>
        props.onOpenChange ? props.onOpenChange(details.open) : undefined
      }
      onSelect={(item) => props.onSelect(item.value)}
      positioning={{
        placement: props.placement ?? "bottom",
        sameWidth: props.sameWidth,
      }}
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
          disabled={props.disabled}
          class={`cursor-pointer outline-0 ${props.class ?? ""}`}
          classList={{
            "not-group-hover:invisible": props.hover,
          }}
        >
          {props.elt}
        </ArkMenu.Trigger>
      </Show>
      <ArkMenu.Positioner>
        <ArkMenu.Content
          class={`bg-bg-2 text-fg-1 border-1 border-fg-3 shadow outline-0 flex flex-col z-200 ${props.textSize ?? "text-lg"}`}
          classList={{
            "grid grid-col-2 grid-rows-8 grid-flow-col": props.style == "nags",
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
                      class={`flex items-center cursor-pointer gap-2 px-4 py-2 ${item.cssClass ?? ""}`}
                      classList={{
                        "bg-selection": item.selected,
                        "hover:bg-highlight-2": item.disabled !== true,
                      }}
                    >
                      {item.icon}
                      {item.text}
                    </ArkMenu.Item>
                  )}
                </Match>
                <Match when={item() === undefined}>
                  <div class="h-px bg-fg-3"></div>
                </Match>
              </Switch>
            )}
          </Index>
        </ArkMenu.Content>
      </ArkMenu.Positioner>
    </ArkMenu.Root>
  );
}

export interface MenuButtonProps {
  items: (MenuItem | undefined)[];
  class?: string;
  text?: string;
  title?: string;
  textSize?: string;
  icon?: JSXElement;
  disabled?: boolean;
  selected?: boolean;
  style?: "normal" | "full" | "flat" | "nags";
  onOpenChange?: (open: boolean) => void;
  onSelect: (value: string) => void;
  sameWidth?: boolean;
  placement?:
    | "top"
    | "bottom"
    | "top-start"
    | "top-end"
    | "bottom-start"
    | "bottom-end";
}

export function MenuButton(props: MenuButtonProps) {
  const [menuProps] = splitProps(props, [
    "items",
    "onOpenChange",
    "disabled",
    "onSelect",
    "placement",
    "textSize",
    "sameWidth",
  ]);
  const elt = createMemo(() => {
    let buttonStyle: "flat" | "normal";
    if (props.style == "flat" || props.style == "nags") {
      buttonStyle = "flat";
    } else {
      buttonStyle = "normal";
    }

    return (
      <div
        class={buttonClass(
          buttonStyle,
          props.disabled ?? false,
          props.textSize,
        )}
        classList={{
          "w-full": props.style == "full",
        }}
      >
        {props.icon} {props.text}
      </div>
    );
  });

  return (
    <Menu
      elt={elt()}
      class={props.style == "full" ? "w-full" : undefined}
      style={props.style == "nags" ? "nags" : undefined}
      {...menuProps}
    />
  );
}
