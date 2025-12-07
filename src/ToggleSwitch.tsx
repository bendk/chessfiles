import { Switch as ArcSwitch } from "@ark-ui/solid/switch";
import { Show } from "solid-js";

export interface ToggleSwitchProps {
  label?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
}

export function ToggleSwitch(props: ToggleSwitchProps) {
  return (
    <ArcSwitch.Root
      checked={props.checked}
      onCheckedChange={(e) => {
        if (props.onChange) {
          props.onChange(e.checked);
        }
      }}
    >
      <ArcSwitch.Control class="flex w-7 h-3 items-center border-1 border-fg-3 rounded-full data-[state=checked]:justify-end cursor-pointer">
        <ArcSwitch.Thumb class="w-3 h-3 bg-fg-2 rounded-full data-[state=checked]:bg-highlight-1" />
      </ArcSwitch.Control>
      <Show when={props.label}>
        <ArcSwitch.Label>{props.label}</ArcSwitch.Label>
      </Show>
      <ArcSwitch.HiddenInput />
    </ArcSwitch.Root>
  );
}
