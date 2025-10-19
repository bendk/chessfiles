import { createSignal, Show } from "solid-js";
import { Field } from "@ark-ui/solid";
import { Book, BookType, RootNode } from "~/lib/node";
import type { AppStorage } from "~/lib/storage";
import { Button, RadioGroup } from "~/components";

interface CreateBookProps {
  title: string;
  submitText: string;
  storage: AppStorage;
  onClose: () => void;
  onCreate: (name: string, book: Book) => Promise<boolean>;
}

export function CreateBook(props: CreateBookProps) {
  const [name, setName] = createSignal("");
  const [error, setError] = createSignal("");
  const [bookType, setBookType] = createSignal<string | null>("normal");
  const [color, setColor] = createSignal<string | null>("white");
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
    <div class="px-4 py-4">
      <div class="flex justify-between">
        <h1 class="text-3xl truncate text-ellipsis">{props.title}</h1>
        <Button text="Cancel" onClick={props.onClose} />
      </div>
      <div class="flex flex-col gap-8 pb-16">
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
      <Button
        disabled={disabled()}
        text={props.submitText}
        onClick={onCreate}
      />
    </div>
  );
}
