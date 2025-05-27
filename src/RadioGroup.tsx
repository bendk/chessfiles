import type { JSXElement } from "solid-js";
import { RadioGroup as ArkRadioGroup } from "@ark-ui/solid";

export interface RootProps {
  onValueChange?: (value: string | null) => void;
  children: JSXElement;
}

export function Root(props: RootProps) {
  return (
    <ArkRadioGroup.Root
      class="flex flex-col"
      onValueChange={(details) =>
        props.onValueChange ? props.onValueChange(details.value) : null
      }
    >
      {props.children}
    </ArkRadioGroup.Root>
  );
}

export interface LabelProps {
  text: string;
}

export function Label(props: LabelProps) {
  return (
    <ArkRadioGroup.Label class="text-lg pb-1 dark:text-zinc-400">
      {props.text}
    </ArkRadioGroup.Label>
  );
}

export interface ItemProps {
  text: string;
  value: string;
  disabled?: boolean;
}

export function Item(props: ItemProps) {
  return (
    <ArkRadioGroup.Item
      disabled={props.disabled}
      class="flex items-center gap-2 text-lg"
      classList={{
        "cursor-pointer": props.disabled !== true,
        "text-zinc-400": props.disabled,
      }}
      value={props.value}
    >
      <ArkRadioGroup.ItemControl class="w-2 h-2 ml-2 mr-1 outline-1 outline-offset-4 data-[state=checked]:border-1 rounded-full data-[state=checked]:bg-gray-100" />
      <ArkRadioGroup.ItemText>{props.text}</ArkRadioGroup.ItemText>
      <ArkRadioGroup.ItemHiddenInput />
    </ArkRadioGroup.Item>
  );
}
