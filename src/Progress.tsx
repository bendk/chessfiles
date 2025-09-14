import { Show } from "solid-js";
import { Progress as ArkProgress } from "@ark-ui/solid";

export interface ProgressProps {
  value: number | null;
  label?: string;
}

export function Progress(props: ProgressProps) {
  return (
    <ArkProgress.Root value={props.value} class="py-2 w-full">
      <Show when={props.label}>
        <ArkProgress.Label>{props.label}</ArkProgress.Label>
      </Show>
      <ArkProgress.Track class="w-full h-6 border-1 border-zinc-700 rounded-md relative">
        <div class="absolute left-0 right-0 top-0 bottom-0 flex justify-center items-center">
          <ArkProgress.ValueText />
        </div>
        <ArkProgress.Range class="bg-sky-600 rounded h-full" />
      </ArkProgress.Track>
    </ArkProgress.Root>
  );
}
