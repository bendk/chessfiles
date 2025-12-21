import { createEffect, createSignal } from "solid-js";
import { Field } from "@ark-ui/solid";
import { Book } from "~/lib/node";
import { filenameValid } from "~/lib/storage";
import type { AppStorage } from "~/lib/storage";
import { Dialog } from "~/components";

interface CreateBookDialogProps {
  storage: AppStorage;
  onClose: () => void;
  onCreate: (name: string, book: Book) => Promise<boolean>;
}

export function CreateBookDialog(props: CreateBookDialogProps) {
  const [name, setName] = createSignal("");
  const [error, setError] = createSignal("");
  const disabled = () => !filenameValid(name(), "file");
  function onKeyPress(e: KeyboardEvent) {
    if (e.key === "Enter" && !disabled()) {
      onCreate();
    }
  }

  createEffect(() => {
    if (disabled() && name() != "") {
      setError("Invalid name");
    } else {
      setError("");
    }
  });

  async function onCreate() {
    if (disabled()) {
      return;
    }

    const book = new Book([]);
    if (!(await props.onCreate(name(), book))) {
      setError("File Already Exists");
      return;
    }
    setName("");
  }
  return (
    <Dialog
      title="Create new book"
      submitText="Create Book"
      onSubmit={onCreate}
      disabled={disabled()}
      closeText="Cancel"
      onClose={props.onClose}
    >
      <div class="flex flex-col gap-8 pb-16">
        <Field.Root class="flex flex-col gap-1" invalid={error() != ""}>
          <Field.Label>Name</Field.Label>
          <Field.Input
            value={name()}
            onKeyPress={onKeyPress}
            onInput={(e) => setName(e.currentTarget.value)}
            class="border-1 border-fg-3 rounded-md px-2 py-1 outline-0"
          />
          <Field.ErrorText class="text-error">{error()}</Field.ErrorText>
        </Field.Root>
      </div>
    </Dialog>
  );
}
