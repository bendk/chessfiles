import Edit from "lucide-solid/icons/edit";
import { Field } from "@ark-ui/solid";
import type { JSXElement } from "solid-js";
import { createMemo, createSignal, Match, Show, Switch } from "solid-js";
import type { Editor, EditorView } from "~/lib/editor";
import { menuItem, Button, Dialog, MenuButton } from "~/components";

export interface HeaderFieldProps {
  label: string;
  key: string;
  view: EditorView;
  setView: (view: EditorView) => void;
  editor: Editor;
}

function HeaderField(props: HeaderFieldProps) {
  function setValue(value: string) {
    props.editor.setHeaderValue(props.key, value);
    props.setView(props.editor.view);
  }

  return (
    <Field.Root class="flex flex-col gap-1 pb-2">
      <Field.Label>{props.label}</Field.Label>
      <Field.Input
        value={props.view.headers.get(props.key)}
        onChange={(evt) => setValue(evt.target.value)}
        onKeyUp={(evt) => {
          if (evt.key == "Enter") {
            evt.currentTarget.blur();
          }
        }}
        class="border-1 border-fg-3 rounded-md px-2 py-1 outline-0"
      />
    </Field.Root>
  );
}

export interface ResultFieldProps {
  view: EditorView;
  setView: (view: EditorView) => void;
  editor: Editor;
}

function ResultField(props: ResultFieldProps) {
  function setValue(value: string) {
    props.editor.setHeaderValue("Result", value);
    props.setView(props.editor.view);
  }

  const possibleValues = ["1-0", "1/2-1/2", "0-1", "*"];

  return (
    <Field.Root class="flex flex-col gap-1 pb-2">
      <Field.Label>Result</Field.Label>
      <div class="flex">
        <MenuButton
          textSize="text-md"
          placement="top-start"
          text={props.view.headers.get("Result")}
          items={possibleValues.map((value) =>
            menuItem(value, value, {
              selected: props.view.headers.get("Result") == value,
            }),
          )}
          onSelect={setValue}
        />
      </div>
    </Field.Root>
  );
}

export interface DateFieldProps {
  view: EditorView;
  setView: (view: EditorView) => void;
  editor: Editor;
}

function DateField(props: DateFieldProps) {
  function parsePgnDate(value: string | undefined): string | undefined {
    if (value === undefined || value == "????.??.??") {
      return undefined;
    }
    return value.replace(/\./g, "-");
  }

  function formatPgnDate(timestamp: number): string {
    const d = new Date(timestamp);
    return `${d.getFullYear().toString().padStart(4, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${(d.getDate() + 1).toString().padStart(2, "0")}`;
  }

  const [error, setError] = createSignal("");
  const [value, setValue] = createSignal(
    parsePgnDate(props.view.headers.get("Date")),
  );

  function onUpdate(value: string) {
    if (value == "") {
      props.editor.setHeaderValue("Date", undefined);
      props.setView(props.editor.view);
      return;
    }
    const timestamp = Date.parse(value);
    if (isNaN(timestamp)) {
      setError("Invalid date");
      return;
    }
    setError("");
    setValue(value);
    props.editor.setHeaderValue("Date", formatPgnDate(timestamp));
    props.setView(props.editor.view);
  }

  return (
    <Field.Root
      class="flex flex-col gap-1 pb-2"
      invalid={error() == "" ? undefined : true}
    >
      <Field.Label class="pb-1">Date</Field.Label>
      <div class="flex gap-2">
        <input
          type="date"
          value={value()}
          onChange={(evt) => onUpdate(evt.target.value)}
        />
        <div class="text-error">
          <Show when={error() != ""}>
            <Field.ErrorText>{error()}</Field.ErrorText>
          </Show>
        </div>
      </div>
    </Field.Root>
  );
}

export interface GameInfoProps {
  view: EditorView;
  setView: (view: EditorView) => void;
  editor: Editor;
}

function headerSet(value: string | undefined): boolean {
  return value !== undefined && value != "" && value != "?";
}

function resultSet(value: string | undefined): boolean {
  return value !== undefined && value != "" && value != "*";
}

function dateSet(value: string | undefined): boolean {
  return value !== undefined && value != "" && value != "????.??.??";
}

export function GameInfo(props: GameInfoProps) {
  const [dialog, setDialog] = createSignal(false);

  const gameInfo = createMemo(() => {
    const elts: JSXElement[] = [];
    const white = props.view.headers.get("White");
    const black = props.view.headers.get("Black");
    const result = props.view.headers.get("Result");
    const event = props.view.headers.get("Event");
    const site = props.view.headers.get("Site");
    const date = props.view.headers.get("Date");
    const round = props.view.headers.get("Round");

    let valueSet = false;

    if (headerSet(white) || headerSet(black) || resultSet(result)) {
      valueSet = true;
      elts.push(`${white ?? "?"} vs ${black ?? "?"}`);
      if (resultSet(result)) {
        elts.push(result);
      }
    }
    if (
      headerSet(event) ||
      headerSet(site) ||
      dateSet(date) ||
      headerSet(round)
    ) {
      valueSet = true;
      if (elts.length > 0) {
        elts.push(<br />);
      }
      if (headerSet(event)) {
        elts.push(event + " ");
      }
      if (headerSet(site)) {
        elts.push(site + " ");
      }
      if (dateSet(date)) {
        elts.push(date + " ");
      }
      if (headerSet(round)) {
        elts.push(`Round ${round} `);
      }
    }
    if (!valueSet) {
      elts.push(<span class="italic">Game info not set</span>);
    }
    return elts;
  });

  return (
    <Switch>
      <Match when={dialog()}>
        <Dialog
          onSubmit={() => setDialog(false)}
          title="Edit Game Info"
          submitText="Close"
        >
          <HeaderField
            label="White Player"
            key="White"
            editor={props.editor}
            view={props.view}
            setView={props.setView}
          />
          <HeaderField
            label="Black Player"
            key="Black"
            editor={props.editor}
            view={props.view}
            setView={props.setView}
          />
          <HeaderField
            label="Event"
            key="Event"
            editor={props.editor}
            view={props.view}
            setView={props.setView}
          />
          <HeaderField
            label="Site"
            key="Site"
            editor={props.editor}
            view={props.view}
            setView={props.setView}
          />
          <DateField
            editor={props.editor}
            view={props.view}
            setView={props.setView}
          />
          <HeaderField
            label="Round"
            key="Round"
            editor={props.editor}
            view={props.view}
            setView={props.setView}
          />
          <ResultField
            editor={props.editor}
            view={props.view}
            setView={props.setView}
          />
        </Dialog>
      </Match>
      <Match when={true}>
        <div class="flex items-center justify-center">
          <Button
            icon={<Edit size={20} />}
            style="flat"
            onClick={() => setDialog(true)}
          />
          <div class="w-100 truncate">{gameInfo()}</div>
        </div>
      </Match>
    </Switch>
  );
}
