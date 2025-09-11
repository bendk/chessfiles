import { createSignal, Match, Show, Switch } from "solid-js";
import X from "lucide-solid/icons/x";
import Alert from "lucide-solid/icons/circle-alert";
import Check from "lucide-solid/icons/circle-check";
import LoaderCircle from "lucide-solid/icons/loader-circle";

/**
 * Exception that we'll display the error message directly in the status bar.
 */
export class StatusError extends Error {
  constructor(public description: string) {
    super(description);
  }
}

export type StatusType = "operation-info" | "error" | "success";

export interface StatusMessage {
  title: string;
  description?: string;
}

export interface Status {
  type: StatusType;
  title: string;
  description?: string;
  fadeOut?: "now" | "after-delay";
}

/**
 * Utility class to track the status of async operations
 */
export class StatusTracker {
  status: () => Status | null;
  private setStatus: (status: Status | null) => void;

  constructor() {
    [this.status, this.setStatus] = createSignal(null);
  }

  async perform(message: string | StatusMessage, action: () => Promise<void>) {
    let status = makeStatus("operation-info", message);
    this.setStatus(status);
    try {
      await action();
    } catch (e) {
      console.log(e);

      if (e instanceof StatusError) {
        status = {
          type: "error",
          title: status.title,
          description: e.description,
        };
      } else {
        status = {
          type: "error",
          title: `Error: ${status.title}`,
          description: undefined,
        };
      }
      this.setStatus(status);
      return;
    }
    this.setStatus({
      ...status,
      type: "success",
      fadeOut: "after-delay",
    });
  }

  dismiss() {
    const status = this.status();
    if (status) {
      this.setStatus({
        ...status,
        fadeOut: "now",
      });
    }
  }

  remove() {
    this.setStatus(null);
  }
}

function makeStatus(type: StatusType, message: string | StatusMessage): Status {
  if (typeof message == "string") {
    return {
      type,
      title: message,
    };
  } else {
    return {
      type,
      ...message,
    };
  }
}

export interface StatusProps {
  status: StatusTracker;
}

export function Status(props: StatusProps) {
  return (
    <Show when={props.status.status()}>
      {(status) => {
        return (
          <div
            on:transitionend={(e) => {
              console.log("transitionend");
              if (e.target.classList.contains("opacity-0")) {
                props.status.remove();
              }
            }}
            class="absolute z-200 top-4 right-4 flex flex-col bg-white dark:bg-zinc-900 border-1 border-zinc-600 w-120 shadow-md shadow-zinc-800 dark:shadow-zinc-950 py-2 px-2 transition-opacity duration-1500 ease-in-out"
            classList={{
              "opacity-100": status().fadeOut === undefined,
              "opacity-0": status().fadeOut !== undefined,
              "delay-1000": status().fadeOut == "after-delay",
            }}
          >
            <div class="flex items-center gap-4">
              <Switch>
                <Match when={status().type == "operation-info"}>
                  <LoaderCircle size={24} class="animate-spin" />
                </Match>
                <Match when={status().type == "success"}>
                  <Check size={24} class="text-green-500" />
                </Match>
                <Match when={status().type == "error"}>
                  <Alert size={24} class="text-red-500" />
                </Match>
              </Switch>
              <div class="flex flex-col">
                <div class="flex justify-between">
                  <div
                    class="font-bold text-lg"
                    classList={{
                      "text-red-500": status().type == "error",
                    }}
                  >
                    {status().title}
                  </div>
                  <Show when={status().type == "error"}>
                    <button
                      onClick={() => props.status?.dismiss()}
                      class="cursor-pointer text-zinc-800 dark:text-zinc-300 hover:text-red-500"
                    >
                      <X />
                    </button>
                  </Show>
                </div>
                <Show when={status().description} keyed>
                  {(desc) => <div class="text-zinc-400">{desc}</div>}
                </Show>
              </div>
            </div>
          </div>
        );
      }}
    </Show>
  );
}
