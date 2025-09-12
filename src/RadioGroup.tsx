import type { JSXElement } from "solid-js";
import { Show } from "solid-js";
import { RadioGroup as ArkRadioGroup } from "@ark-ui/solid";

export interface RootProps {
  value?: string;
  class?: string;
  onValueChange?: (value: string | null) => void;
  children: JSXElement;
}

export function Root(props: RootProps) {
  return (
    <ArkRadioGroup.Root
      class={`flex flex-col ${props.class}`}
      value={props.value}
      onValueChange={(details) => {
        return props.onValueChange ? props.onValueChange(details.value) : null;
      }}
    >
      {props.children}
    </ArkRadioGroup.Root>
  );
}

export interface LabelProps {
  text: string;
  help?: string;
}

export function Label(props: LabelProps) {
  return (
    <ArkRadioGroup.Label>
      <div class="flex flex-col pb-2">
        <div class="dark:text-zinc-200 text-xl">{props.text}</div>
        <Show when={props.help} keyed>
          {(help_text) => (
            <div class="dark:text-zinc-400 pb-0.5">{help_text}</div>
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
  disabled?: boolean;
}

export function Item(props: ItemProps) {
  return (
    <div class="flex flex-col pb-1">
      <ArkRadioGroup.Item
        disabled={props.disabled}
        class="flex items-center gap-2"
        classList={{
          "cursor-pointer": props.disabled !== true,
          "cursor-not-allowed": props.disabled === true,
          "text-zinc-400": props.disabled,
        }}
        value={props.value}
      >
        <ArkRadioGroup.ItemControl class="w-3.5 h-3.5 ml-1 data-[state=checked]:bg-sky-500 border-1 rounded-full" />
        <ArkRadioGroup.ItemText>{props.text}</ArkRadioGroup.ItemText>
        <ArkRadioGroup.ItemHiddenInput />
      </ArkRadioGroup.Item>
      <Show when={props.help} keyed>
        {(text) => <div class="text-zinc-400 pl-6 pb-1">{text}</div>}
      </Show>
    </div>
  );
}
