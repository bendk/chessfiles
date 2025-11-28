import {
  createRenderEffect,
  createSignal,
  onMount,
  Index,
  Match,
  Show,
  Switch,
} from "solid-js";

import { Button, Dialog, Progress } from "~/components";
import type { OperationCallbacks } from "~/lib/storage";

export interface ProgressDialogProps {
  title: string;
  operation: (callbacks: OperationCallbacks) => Promise<void>;
  onClose: () => void;
}

type ConflictChoice = "overwrite" | "overwrite-all" | "skip" | "skip-all";

export function ProgressDialog(props: ProgressDialogProps) {
  const [canceled, setCanceled] = createSignal(false);
  const [error, setError] = createSignal("");
  const [importLog, setImportLog] = createSignal<string[]>([]);
  const [conflictPath, setConflictPath] = createSignal("");
  const [progress, setProgress] = createSignal(0.0);

  let resolveCurrentOverwrite: ((overwrite: boolean) => void) | null = null;
  let permanentOverwriteChoice = "";

  onMount(() => {
    const callbacks = {
      progress: updateProgress,
      log: pushLogEntry,
      shouldOverwrite: shouldOverwrite,
      canceled,
    };
    props.operation(callbacks).catch((e) => {
      console.trace("operation failed", e);
      setError("Operation failed");
    });
  });

  function updateProgress(current: number, total: number) {
    if (!canceled()) {
      setProgress((100 * current) / total);
    }
  }

  function pushLogEntry(entry: string) {
    setImportLog([...importLog(), entry]);
  }

  function shouldOverwrite(path: string): Promise<boolean> {
    setConflictPath(`File exists: ${path}`);
    const promise = new Promise<boolean>((resolve) => {
      if (permanentOverwriteChoice == "skip") {
        resolve(false);
      } else if (permanentOverwriteChoice == "overwrite") {
        resolve(true);
      } else {
        resolveCurrentOverwrite = resolve;
      }
    });
    return promise;
  }

  function handleConflictChoice(choice: ConflictChoice) {
    if (resolveCurrentOverwrite === null) {
      console.error("handleConflictChoice: no promise set");
      return;
    }

    if (choice == "skip") {
      resolveCurrentOverwrite(false);
    } else if (choice == "skip-all") {
      permanentOverwriteChoice = "skip";
      resolveCurrentOverwrite(false);
    } else if (choice == "overwrite") {
      resolveCurrentOverwrite(true);
    } else if (choice == "overwrite-all") {
      permanentOverwriteChoice = "overwrite";
      resolveCurrentOverwrite(true);
    }
    resolveCurrentOverwrite = null;
  }

  let importLogElt!: HTMLUListElement;
  createRenderEffect(() => {
    importLog();
    if (importLogElt) {
      importLogElt.scrollTop = importLogElt.scrollHeight;
    }
  });

  return (
    <Dialog title={props.title}>
      <div class="flex flex-col">
        <ul class="h-40 overflow-auto mb-8" ref={importLogElt}>
          <Index each={importLog()}>{(log) => <li>{log()}</li>}</Index>
        </ul>
        <div class="grow" />
        <Show when={conflictPath() != ""}>
          <div class="text-amber-600 dark:text-amber-300">{conflictPath()}</div>
          <div class="flex pt-2 justify-between">
            <div class="flex gap-4">
              <Button
                text="Overwrite"
                onClick={() => handleConflictChoice("overwrite")}
              />
              <Button
                text="Skip"
                onClick={() => handleConflictChoice("skip")}
              />
            </div>
            <div class="flex gap-4">
              <Button
                text="Overwrite All"
                onClick={() => handleConflictChoice("overwrite-all")}
              />
              <Button
                text="Skip all"
                onClick={() => handleConflictChoice("skip-all")}
              />
            </div>
          </div>
        </Show>
        <Show when={error()}>
          <div class="text-red-500">{error()}</div>
        </Show>
        <Progress value={progress()} />
        <div class="flex justify-start">
          <Switch>
            <Match when={progress() < 100 && !canceled()}>
              <Button
                text="Cancel"
                onClick={() => {
                  setCanceled(true);
                  setError("Canceled");
                }}
              />
            </Match>
            <Match when={true}>
              <Button text="Finish" onClick={props.onClose} />
            </Match>
          </Switch>
        </div>
      </div>
    </Dialog>
  );
}
