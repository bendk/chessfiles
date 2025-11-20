import { createUniqueId, Show } from "solid-js";

export interface CheckboxProps {
  class?: string;
  checked?: boolean;
  label?: string;
  onChange?: (value: boolean) => void;
}

export function Checkbox(props: CheckboxProps) {
  const id = createUniqueId();
  return (
    <div
      class={`flex gap-2 ${props.class}`}
      onclick={(e) => {
        e.stopPropagation();
      }}
    >
      <input
        id={id}
        type="checkbox"
        class="w-5 h-5 cursor-pointer"
        checked={props.checked}
        onchange={(e) => {
          if (props.onChange) {
            props.onChange(e.target.checked);
          }
        }}
      />
      <Show when={props.label}>
        <label class="cursor-pointer" for={id}>
          {props.label}
        </label>
      </Show>
    </div>
  );
}
