import type { JSXElement } from "solid-js";
import { Show } from "solid-js";
import { Portal } from "solid-js/web";
import { Dialog as ArkDialog } from "@ark-ui/solid";
import LoaderCircle from "lucide-solid/icons/loader-circle";
import { Button } from "./components";

interface DialogProps {
  title: string;
  children: JSXElement;
  loading?: boolean;
  disabled?: boolean;
  height?: number;
  submitText: string;
  onSubmit: () => void;
  onClose?: () => void;
}

export function Dialog(props: DialogProps) {
  return (
    <ArkDialog.Root open={true} onOpenChange={props.onClose}>
      <Portal>
        <ArkDialog.Backdrop class="bg-zinc-900 opacity-80 absolute left-0 top-0 h-full w-full z-99" />
        <ArkDialog.Positioner>
          <ArkDialog.Content
            class="fixed top-20 left-20 right-20 z-100 border-1 dark:border-zinc-700 shadow-lg shadow-zinc-800 dark:shadow-zinc-950 bg-zinc-100 dark:bg-gray-900 text-zinc-700 dark:text-zinc-300 flex flex-col"
            style={
              props.height !== undefined
                ? `height: ${props.height}px`
                : undefined
            }
          >
            <ArkDialog.Title class="bg-sky-400 dark:bg-slate-700 px-4 py-2 text-2xl">
              {props.title}
            </ArkDialog.Title>
            <ArkDialog.Description class="flex flex-col px-4 py-4 grow">
              <div class="grow">{props.children}</div>
              <div class="flex justify-between pt-8">
                <Button
                  text={props.submitText}
                  icon={
                    <Show when={props.loading}>
                      <LoaderCircle class="animate-spin" />
                    </Show>
                  }
                  onClick={props.onSubmit}
                />
                <Show when={props.onClose}>
                  <Button text="Close" onClick={props.onClose} />
                </Show>
              </div>
            </ArkDialog.Description>
          </ArkDialog.Content>
        </ArkDialog.Positioner>
      </Portal>
    </ArkDialog.Root>
  );
}
