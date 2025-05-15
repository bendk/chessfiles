import type { JSX } from "solid-js";

interface ButtonProps {
  class?: string;
  text?: string;
  icon?: JSX.Element;
  disabled?: boolean;
  narrow?: boolean;
  selected?: boolean;
  primary?: boolean;
  onClick?: () => void;
}

export function Button(props: ButtonProps) {
  const enabled = () => props.disabled !== true;
  return (
    <button
      class="flex gap-1 items-center justify-center border-1 rounded-md px-3 text-lg font-medium"
      classList={{
        [props.class as string]: !!props.class,
        "py-1": props.narrow !== true,
        "text-zinc-300": !enabled(),
        "border-zinc-400": props.primary !== true || !enabled(),
        "bark:border-zinc-500": props.primary !== true || !enabled(),
        "border-zinc-500": props.primary && enabled(),
        "dark:border-zinc-300": props.primary && enabled(),
        "cursor-pointer": enabled(),
        "bg-sky-900": props.selected,
        "hover:bg-sky-200": enabled(),
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
