import { createMemo } from "solid-js";
import type { JSX } from "solid-js";

export type ButtonStyle = "normal" | "primary" | "flat";

interface ButtonProps {
  class?: string;
  text?: string;
  title?: string;
  icon?: JSX.Element;
  disabled?: boolean;
  style?: ButtonStyle;
  textSize?: string;
  onClick?: () => void;
}

export function Button(props: ButtonProps) {
  const cls = createMemo(() => {
    const cls = buttonClass(
      props.style ?? "normal",
      props.disabled ?? false,
      props.textSize,
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
      onClick={(evt) => {
        if (props.disabled !== true && props.onClick) {
          props.onClick();
          evt.stopPropagation();
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
  textSize?: string,
): string {
  let cls = `flex gap-1 items-center justify-center border-1 rounded-md px-3 py-1 ${textSize ?? "text-lg"}`;

  if (!disabled) {
    cls += " cursor-pointer";
  }

  if (style == "flat") {
    cls += " border-transparent";
    if (!disabled) {
      cls += " hover:border-fg-2";
    }
  } else if (disabled) {
    cls += " border-fg-3";
  } else {
    cls += " border-fg-2";
  }

  if (disabled) {
    cls += " text-fg-2";
  } else if (style == "flat") {
    cls += " hover-bg";
  } else if (style == "primary") {
    cls += " hover-bg";
  } else {
    cls += " hover-bg";
  }

  return cls;
}
