import type { JSXElement } from "solid-js";
import { Show } from "solid-js";
import { RadioGroup as ArkRadioGroup } from "@ark-ui/solid";

export interface RootProps {
  value?: string;
  onValueChange?: (value: string | null) => void;
  children: JSXElement;
}

export function Root(props: RootProps) {
  return (
    <ArkRadioGroup.Root
      class="flex flex-col"
      value={props.value}
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
  help?: string;
  small?: boolean;
}

export function Label(props: LabelProps) {
  return (
    <ArkRadioGroup.Label class="pb-2">
      <div class="flex flex-col">
        <div
          class="dark:text-zinc-200"
          classList={{
            "text-xl": props.small !== true,
          }}
        >
          {props.text}
        </div>
        <Show when={props.help} keyed>
          {(help_text) => (
            <div class="text-sm dark:text-zinc-400">{help_text}</div>
          )}
        </Show>
      </div>
    </ArkRadioGroup.Label>
  );
}

export interface ItemProps {
  text: string;
  value: string;
  help?: string;
  small?: boolean;
  disabled?: boolean;
}

export function Item(props: ItemProps) {
  return (
    <div class="flex flex-col">
      <ArkRadioGroup.Item
        disabled={props.disabled}
        class="flex items-center gap-2"
        classList={{
          "cursor-pointer": props.disabled !== true,
          "text-zinc-400": props.disabled,
          "text-lg": props.small !== true,
        }}
        value={props.value}
      >
        <ArkRadioGroup.ItemControl class="w-3.5 h-3.5 ml-1 data-[state=checked]:bg-sky-500 border-1 rounded-full" />
        <ArkRadioGroup.ItemText>{props.text}</ArkRadioGroup.ItemText>
        <ArkRadioGroup.ItemHiddenInput />
      </ArkRadioGroup.Item>
      <Show when={props.help} keyed>
        {(text) => <div class="text-zinc-400 pl-6">{text}</div>}
      </Show>
    </div>
  );
}
