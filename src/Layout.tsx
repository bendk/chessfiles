import type { JSXElement } from "solid-js";
import { Show } from "solid-js";
import LoaderCircle from "lucide-solid/icons/loader-circle";
import type { StatusTracker } from "./components";
import { StandardNavbar } from "./components";

export interface LayoutProps {
  children: JSXElement;
  navbar?: boolean;
  status?: StatusTracker;
}

export function Layout(props: LayoutProps) {
  return (
    <div class="flex flex-col bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-300 h-screen outline-hidden">
      <Show when={props.navbar !== false}>
        <StandardNavbar />
      </Show>
      <div class="min-h-0 pt-4 px-10 overflow-y-auto grow">
        {props.children}
      </div>
      <div class="flex items-center h-10 py-6 px-2">
        <Show when={props.status} keyed>
          {(status) => (
            <>
              <div class="w-2">
                <Show when={status.loading()}>
                  <LoaderCircle class="animate-spin duration-1000" size={18} />
                </Show>
              </div>
              <span
                class="pl-5 text-lg"
                classList={{
                  "text-red-500": status.error(),
                }}
              >
                {status.message()}
              </span>
            </>
          )}
        </Show>
      </div>
    </div>
  );
}
