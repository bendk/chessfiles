import type { JSXElement } from "solid-js";
import { Show } from "solid-js";
import { Portal } from "solid-js/web";
import { Dialog as ArkDialog } from "@ark-ui/solid";
import SquareX from "lucide-solid/icons/square-x";
import LoaderCircle from "lucide-solid/icons/loader-circle";
import { Button } from "./Button";

interface DialogProps {
  onClose?: () => void;
  onSubmit?: () => void;
  title: string;
  submitText?: string;
  withCancel?: boolean;
  withClose?: boolean;
  loading?: boolean;
  children: JSXElement;
  disabled?: boolean;
  height?: number;
}

export function Dialog(props: DialogProps) {
  const disabled = () => props.disabled === true || props.loading === true;
  const onButtonClick = () => {
    if (!disabled() && props.onSubmit) {
      props.onSubmit();
    }
  };

  return (
    <ArkDialog.Root open={true} onOpenChange={props.onClose}>
      <Portal>
        <ArkDialog.Backdrop class="bg-zinc-900 opacity-80 absolute left-0 top-0 h-full w-full z-99" />
        <ArkDialog.Positioner>
          <ArkDialog.Content
            class="fixed top-20 left-20 right-20 z-100 border-1 dark:border-zinc-700 shadow-lg shadow-zinc-800 dark:shadow-zinc-950 bg-zinc-100 dark:bg-gray-900 text-zinc-800 dark:text-zinc-300 flex flex-col"
            style={
              props.height !== undefined
                ? `height: ${props.height}px`
                : undefined
            }
          >
            <ArkDialog.Title class="bg-amber-400 dark:bg-slate-700 px-4 py-2 text-2xl">
              {props.title}
            </ArkDialog.Title>
            <ArkDialog.Description class="px-4 py-4 flex flex-col grow">
              <div class="grow">{props.children}</div>
              <div class="mt-8 h-8 flex justify-between">
                <Show when={props.submitText}>
                  <Button
                    text={props.submitText}
                    icon={
                      <Show when={props.loading}>
                        <LoaderCircle class="animate-spin" />
                      </Show>
                    }
                    disabled={disabled()}
                    onClick={onButtonClick}
                    primary
                  />
                </Show>
                <Show when={props.withCancel}>
                  <Button text="Cancel" onClick={props.onClose} />
                </Show>
              </div>
            </ArkDialog.Description>
            <Show when={props.withClose !== false}>
              <ArkDialog.CloseTrigger class="absolute right-1 top-1 h-10 w-10 cursor-pointer hover:text-rose-500 flex justify-center items-center">
                <SquareX size={24} />
              </ArkDialog.CloseTrigger>
            </Show>
          </ArkDialog.Content>
        </ArkDialog.Positioner>
      </Portal>
    </ArkDialog.Root>
  );
}
