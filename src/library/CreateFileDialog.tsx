import { createSignal } from "solid-js";
import { Field } from "@ark-ui/solid";
import { FileExistsError } from "~/lib/storage";
import { Dialog } from "~/Dialog";

interface CreateFileDialogProps {
  title: string;
  submitText: string;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function CreateFileDialog(props: CreateFileDialogProps) {
  const [name, setName] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
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
    setLoading(true);
    try {
      await props.onCreate(name());
    } catch (e) {
      setLoading(false);
      if (e instanceof FileExistsError) {
        setError("File Already Exists");
        return;
      } else {
        throw e;
      }
    }
    setLoading(false);
    setName("");
  }
  return (
    <Dialog
      disabled={disabled()}
      onSubmit={onCreate}
      loading={loading()}
      {...props}
    >
      <Field.Root class="flex flex-col gap-1" invalid={error() != ""}>
        <Field.Label>Name</Field.Label>
        <Field.Input
          value={name()}
          onKeyPress={onKeyPress}
          onInput={(e) => setName(e.currentTarget.value)}
          class="border-1 border-zinc-700 rounded-md px-2 py-1 outline-0"
        />
        <Field.ErrorText class="text-rose-500">{error()}</Field.ErrorText>
      </Field.Root>
    </Dialog>
  );
}
