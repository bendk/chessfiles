import { createSignal } from "solid-js";
import { Dialog } from "~/Dialog";
import type { EditorView } from "~/lib/editor";
import type { Color } from "~/lib/chess";
import * as RadioGroup from "~/RadioGroup";

interface EditorDialogProps {
  view: EditorView;
  onSubmit: (color: Color | undefined) => void;
  onClose: () => void;
}

export function EditorDialog(props: EditorDialogProps) {
  const [color, setColor] = createSignal<Color | "both">(
    props.view.color ?? "both",
  );

  function onSelectColor(value: string | null) {
    if (value == "white" || value === "black") {
      setColor(value);
    } else {
      setColor("both");
    }
  }

  function onSubmit() {
    const currentColor = color();
    if (currentColor == "both") {
      props.onSubmit(undefined);
    } else {
      props.onSubmit(currentColor);
    }
  }

  return (
    <Dialog
      title="Book Settings"
      submitText="Close"
      onSubmit={onSubmit}
      onClose={props.onClose}
    >
      <RadioGroup.Root value={color()} onValueChange={onSelectColor}>
        <RadioGroup.Label text="Training Color" small />
        <RadioGroup.Item text="White" value="white" small />
        <RadioGroup.Item text="Black" value="black" small />
        <RadioGroup.Item text="Both" value="both" small />
      </RadioGroup.Root>
    </Dialog>
  );
}
