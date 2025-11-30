import { createEffect, createSignal, Show } from "solid-js";
import { Field } from "@ark-ui/solid";
import { Book, BookType, RootNode } from "~/lib/node";
import { filenameValid } from "~/lib/storage";
import type { AppStorage } from "~/lib/storage";
import { Dialog, RadioGroup } from "~/components";

interface CreateBookDialogProps {
  storage: AppStorage;
  onClose: () => void;
  onCreate: (name: string, book: Book) => Promise<boolean>;
}

export function CreateBookDialog(props: CreateBookDialogProps) {
  const [name, setName] = createSignal("");
  const [error, setError] = createSignal("");
  const [bookType, setBookType] = createSignal<string | null>("normal");
  const [color, setColor] = createSignal<string | null>("white");
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

    let book;
    switch (bookType()) {
      case "normal":
        book = new Book(BookType.Normal, []);
        break;

      case "opening": {
        const node = RootNode.fromInitialPosition();
        switch (color()) {
          case "white":
            node.setColor("white");
            break;

          case "black":
            node.setColor("black");
            break;

          default:
            break;
        }

        book = new Book(BookType.Opening, [node]);
        break;
      }

      default:
        return;
    }

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
        <RadioGroup.Root
          value={bookType() ?? undefined}
          onValueChange={(value) => setBookType(value)}
        >
          <RadioGroup.Label text="Book Type" />
          <RadioGroup.Item
            text="Normal"
            value="normal"
            help="Stores multiple games, game segments, and/or positions"
          />
          <RadioGroup.Item
            text="Opening"
            value="opening"
            help="Stores a single opening tree."
          />
        </RadioGroup.Root>
        <Show when={bookType() == "opening"}>
          <RadioGroup.Root
            value={color() ?? undefined}
            onValueChange={(value) => setColor(value)}
          >
            <RadioGroup.Label
              text="Opening color"
              help="Color you're learining the line for.  This is which side you will play in training sessions."
            />
            <RadioGroup.Item text="White" value="white" />
            <RadioGroup.Item text="Black" value="black" />
            <RadioGroup.Item text="Both" value="both" />
          </RadioGroup.Root>
        </Show>
      </div>
    </Dialog>
  );
}
