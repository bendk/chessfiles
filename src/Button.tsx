import type { JSX } from "solid-js";

interface ButtonProps {
  class?: string;
  text?: string;
  icon?: JSX.Element;
  disabled?: boolean;
  onClick?: () => void;
}

export function Button(props: ButtonProps) {
  const enabled = () => props.disabled !== true;
  return (
    <button
      class="flex gap-1 items-center border-1 rounded-md px-3 py-1 text-lg font-medium"
      classList={{
        [props.class as string]: !!props.class,
        "text-zinc-300": !enabled(),
        "border-zinc-600": !enabled(),
        "cursor-pointer": enabled(),
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
