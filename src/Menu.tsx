import { Menu as ArkMenu } from "@ark-ui/solid";
import type { JSXElement } from "solid-js";
import { createMemo, createSignal, onCleanup, splitProps } from "solid-js";
import { buttonClass } from "./Button";
import type { Rect } from "./components";
import EllipsisVertical from "lucide-solid/icons/ellipsis-vertical";

export type MenuItem = MenuItemNormal | MenuItemSeperator | MenuItemHeader;

export interface MenuItemNormal {
  type: "item";
  icon?: JSXElement;
  text?: string;
  value: string;
  disabled?: boolean;
  selected?: boolean;
  cssClass?: string;
}

export interface MenuItemHeader {
  type: "header";
  text: string;
  cssClass?: string;
}

export interface MenuItemSeperator {
  type: "separator";
}

export function menuItem(
  value: string,
  text: string,
  opts?: {
    icon?: JSXElement;
    disabled?: boolean;
    selected?: boolean;
    cssClass?: string;
  },
): MenuItem {
  return {
    type: "item",
    value,
    text,
    ...opts,
  };
}

export function menuHeader(text: string): MenuItem {
  return {
    type: "header",
    text,
  };
}

export function menuSeparator(): MenuItem {
  return { type: "separator" };
}

export interface MenuProps {
  children: (context: MenuContext) => JSXElement;
  items?: MenuItem[];
  class?: string;
  textSize?: string;
  onOpenChange?: (open: boolean) => void;
  onSelect?: (value: string) => void;
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

export interface MenuContext {
  open: (position: Rect) => void;
  setItems: (items: MenuItem[]) => void;
}

export function Menu(props: MenuProps) {
  const [items, setItems] = createSignal<MenuItem[] | null>(null);
  const [position, setPosition] = createSignal<Rect | null>(null);

  const context: MenuContext = {
    open: setPosition,
    setItems,
  };

  const itemChildren = () => {
    const resolvedItems = items() ?? props.items ?? [];
    return resolvedItems.map((item) => {
      if (item.type == "separator") {
        return <ArkMenu.Separator class="h-px bg-fg-3"></ArkMenu.Separator>;
      }
      if (item.type == "header") {
        return (
          <ArkMenu.Item
            value=""
            disabled={true}
            class={`text-fg-2 flex items-center cursor-pointer gap-2 px-4 py-2 ${item.cssClass ?? ""}`}
          >
            {item.text}
          </ArkMenu.Item>
        );
      }
      return (
        <ArkMenu.Item
          value={item.value}
          disabled={item.disabled}
          class={`flex items-center cursor-pointer gap-2 px-4 py-2 ${item.cssClass ?? ""}`}
          classList={{
            "bg-selection": item.selected,
            "hover:bg-highlight-2": item.disabled !== true,
            "text-fg-2": item.disabled,
          }}
        >
          {item.icon}
          {item.text}
        </ArkMenu.Item>
      );
    });
  };

  return (
    <ArkMenu.Root
      open={position() !== null}
      onOpenChange={(details) => {
        if (!details.open) {
          setPosition(null);
        }
        if (props.onOpenChange) {
          props.onOpenChange(details.open);
        }
      }}
      onSelect={(item) => (props.onSelect ? props.onSelect(item.value) : null)}
      positioning={{
        placement: props.placement ?? "bottom",
        sameWidth: props.sameWidth,
        getAnchorRect: () => {
          return (
            position() ?? {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
            }
          );
        },
      }}
    >
      <ArkMenu.Positioner>
        <ArkMenu.Content
          class={`bg-bg-2 text-fg-1 border-1 border-fg-3 shadow outline-0 flex flex-col z-200 ${props.textSize ?? "text-lg"}`}
          classList={{
            "grid grid-col-2 grid-rows-8 grid-flow-col": props.style == "nags",
          }}
        >
          {itemChildren()}
        </ArkMenu.Content>
      </ArkMenu.Positioner>
      {props.children(context)}
    </ArkMenu.Root>
  );
}

export interface MenuTriggerProps {
  menu: MenuContext;
  elt?: JSXElement;
  generateMenu?: () => MenuItem[];
  onOpen?: () => void;
  hover?: boolean;
}

export function MenuTrigger(props: MenuTriggerProps) {
  const elt = createMemo(() => props.elt ?? <EllipsisVertical size={24} />);
  return (
    <button
      class="cursor-pointer outline-0"
      onClick={(evt) => {
        if (props.generateMenu) {
          props.menu.setItems(props.generateMenu());
        }
        if (props.onOpen) {
          props.onOpen();
        }
        props.menu.open(evt.currentTarget.getBoundingClientRect());
        evt.stopPropagation();
        evt.preventDefault();
      }}
      classList={{
        "not-group-hover:invisible": props.hover,
      }}
    >
      {elt()}
    </button>
  );
}

export interface MenuContextTriggerProps {
  menu: MenuContext;
  children: JSXElement;
  generateMenu?: () => MenuItem[];
  onOpen?: () => void;
}

export function MenuContextTrigger(props: MenuContextTriggerProps) {
  const eventHandlerProps = contextMenuEventHandlers(
    props.menu,
    props.generateMenu,
    props.onOpen,
  );

  return <div {...eventHandlerProps}>{props.children}</div>;
}

export interface ContextMenuEventHandlers {
  onContextMenu: (evt: MouseEvent) => void;
  onPointerDown: (evt: MouseEvent) => void;
  onPointerMove: (evt: MouseEvent) => void;
  onPointerUp: (evt: MouseEvent) => void;
  onPointerCancel: (evt: MouseEvent) => void;
  "on:click": (evt: MouseEvent) => void;
}

export function contextMenuEventHandlers(
  menu: MenuContext,
  generateMenu?: () => MenuItem[],
  onOpen?: () => void,
): ContextMenuEventHandlers {
  function openMenu(evt: MouseEvent) {
    if (generateMenu) {
      menu.setItems(generateMenu());
    }
    if (onOpen) {
      onOpen();
    }
    menu.open({
      x: evt.clientX,
      y: evt.clientY,
      width: 0,
      height: 0,
    });
  }

  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let didLongPress = false;
  function startLongPressTimer(evt: MouseEvent) {
    didLongPress = false;
    clearLongPressTimer();
    longPressTimer = setTimeout(() => {
      didLongPress = true;
      openMenu(evt);
    }, 700);
  }
  function clearLongPressTimer() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
  }

  onCleanup(clearLongPressTimer);

  return {
    onContextMenu: (evt) => {
      openMenu(evt);
      evt.stopPropagation();
      evt.preventDefault();
    },
    // Long-press
    onPointerDown: startLongPressTimer,
    onPointerMove: clearLongPressTimer,
    onPointerUp: clearLongPressTimer,
    onPointerCancel: clearLongPressTimer,
    ["on:click"]: (evt) => {
      if (didLongPress) {
        evt.preventDefault();
        evt.stopPropagation();
      }
    },
  };
}

export interface MenuButtonProps {
  items: MenuItem[];
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
      class={props.style == "full" ? "w-full" : undefined}
      style={props.style == "nags" ? "nags" : undefined}
      {...menuProps}
    >
      {(menu) => <MenuTrigger elt={elt()} menu={menu} />}
    </Menu>
  );
}
