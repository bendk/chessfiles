import { Field } from "@ark-ui/solid";
import { createEffect, createSignal } from "solid-js";
import type { DirEntryType, AppStorage } from "~/lib/storage";
import { filenameValid } from "~/lib/storage";
import type { StatusTracker } from "~/components";
import { Dialog } from "~/components";

export interface RenameFileProps {
  storage: AppStorage;
  status: StatusTracker;
  filename: string;
  fileType: DirEntryType;
  onSubmit: (newFilename: string) => void;
  onClose: () => void;
}

export function RenameFile(props: RenameFileProps) {
  const [newFilename, setNewFilename] = createSignal("");
  const [error, setError] = createSignal("");

  const disabled = () => !filenameValid(newFilename(), props.fileType);

  createEffect(() => {
    if (newFilename() != "" && disabled()) {
      setError("Invalid file name");
    } else {
      setError("");
    }
  });

  function onKeyPress(e: KeyboardEvent) {
    if (e.key === "Enter" && !disabled()) {
      props.onSubmit(newFilename());
    }
  }

  return (
    <Dialog
      onSubmit={() => props.onSubmit(newFilename())}
      onClose={props.onClose}
      title="Renaming file"
      submitText="Rename"
    >
      <div>Renaming {props.filename}</div>
      <Field.Root class="flex flex-col gap-1 pt-8" invalid={error() != ""}>
        <Field.Label>Name</Field.Label>
        <Field.Input
          value={newFilename()}
          onKeyPress={onKeyPress}
          onInput={(e) => setNewFilename(e.currentTarget.value)}
          class="border-1 border-zinc-700 rounded-md px-2 py-1 outline-0"
        />
        <Field.ErrorText class="text-rose-500">{error()}</Field.ErrorText>
      </Field.Root>
    </Dialog>
  );
}
