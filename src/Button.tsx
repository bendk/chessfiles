import type { JSX } from "solid-js";

interface ButtonProps {
  class?: string;
  text?: string;
  icon?: JSX.Element;
  disabled?: boolean;
  selected?: boolean;
  style?: "normal" | "primary" | "flat";
  onClick?: () => void;
}

export function Button(props: ButtonProps) {
  const enabled = () => props.disabled !== true;
  const borderStyle = () => {
    if (props.style == "primary" && enabled()) {
      return "border-zinc-500 dark:border-zinc-300";
    } else if (props.style == "flat") {
      return "border-transparent hover:border-zinc-400 hover:dark:border-zinc-500";
    } else {
      return "border-zinc-400 dark:border-zinc-500";
    }
  };

  return (
    <button
      class={`flex gap-1 items-center justify-center border-1 rounded-md px-3 py-1 text-lg font-medium ${borderStyle()}`}
      classList={{
        [props.class as string]: !!props.class,
        "text-zinc-300": !enabled(),
        "dark:text-zinc-500": !enabled(),
        "cursor-pointer": enabled(),
        "dark:bg-sky-900": props.selected,
        "bg-slate-500": props.selected,
        "text-white": props.selected,
        "hover:text-white": enabled(),
        "hover:bg-sky-400": enabled(),
        "hover:border-sky-500": enabled(),
        "dark:hover:bg-sky-800": enabled(),
      }}
      onClick={() => {
        if (enabled() && props.onClick) {
          props.onClick();
        }
      }}
    >
      {props.icon} {props.text}
    </button>
  );
}
