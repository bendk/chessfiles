import { createMemo } from "solid-js";
import type { JSX } from "solid-js";

export type ButtonStyle = "normal" | "primary" | "flat";

interface ButtonProps {
  class?: string;
  text?: string;
  title?: string;
  icon?: JSX.Element;
  disabled?: boolean;
  selected?: boolean;
  style?: ButtonStyle;
  onClick?: () => void;
}

export function Button(props: ButtonProps) {
  const cls = createMemo(() => {
    const cls = buttonClass(
      props.style ?? "normal",
      props.disabled ?? false,
      props.selected ?? false,
    );
    if (props.class !== undefined) {
      return `${cls} ${props.class}`;
    } else {
      return cls;
    }
  });
  return (
    <button
      class={cls()}
      title={props.title}
      onClick={() => {
        if (props.disabled !== true && props.onClick) {
          props.onClick();
        }
      }}
    >
      {props.icon} {props.text}
    </button>
  );
}

export function buttonClass(
  style: ButtonStyle,
  disabled: boolean,
  selected: boolean,
): string {
  let cls =
    "flex gap-1 items-center justify-center border-1 rounded-md px-3 py-1 text-lg font-medium";

  if (style == "primary" && !disabled) {
    cls += " border-zinc-500 dark:border-zinc-300";
  } else if (style == "flat") {
    cls +=
      " border-transparent hover:border-zinc-400 hover:dark:border-zinc-500";
  } else {
    cls += " border-zinc-400 dark:border-zinc-500";
  }

  if (disabled) {
    cls += " text-zinc-300 dark:text-zinc-500 ";
  } else {
    cls +=
      " cursor-pointer hover:text-white hover:bg-sky-400 hover:border-sky-500 dark:hover:bg-sky-800";
  }

  if (selected) {
    cls += " dark:bg-sky-900 bg-slate-500 text-white";
  }

  return cls;
}
