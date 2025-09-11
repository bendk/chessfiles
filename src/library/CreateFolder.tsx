import { createSignal } from "solid-js";
import { Field } from "@ark-ui/solid";
import type { AppStorage } from "~/lib/storage";
import { Button } from "~/components";

interface CreateFolderProps {
  title: string;
  submitText: string;
  storage: AppStorage;
  onClose: () => void;
  onCreate: (name: string) => Promise<boolean>;
}

export function CreateFolder(props: CreateFolderProps) {
  const [name, setName] = createSignal("");
  const [error, setError] = createSignal("");
  function disabled() {
    // TODO: check for invalid chars, "..", ".", etc.
    return name() == "" || name().indexOf("/") != -1;
  }
  function onKeyPress(e: KeyboardEvent) {
    if (e.key === "Enter" && !disabled()) {
      onCreate();
    }
  }
  async function onCreate() {
    if (disabled()) {
      return;
    }

    if (!(await props.onCreate(name()))) {
      setError("File Already Exists");
      return;
    }
    setName("");
  }
  return (
    <div>
      <div class="flex justify-between">
        <h1 class="text-3xl truncate text-ellipsis">{props.title}</h1>
        <Button text="Cancel" onClick={props.onClose} />
      </div>
      <Field.Root class="flex flex-col gap-1 pt-8" invalid={error() != ""}>
        <Field.Label>Name</Field.Label>
        <Field.Input
          value={name()}
          onKeyPress={onKeyPress}
          onInput={(e) => setName(e.currentTarget.value)}
          class="border-1 border-zinc-700 rounded-md px-2 py-1 outline-0"
        />
        <Field.ErrorText class="text-rose-500">{error()}</Field.ErrorText>
      </Field.Root>
      <Button
        class="mt-8"
        disabled={disabled()}
        text={props.submitText}
        onClick={onCreate}
      />
    </div>
  );
}
