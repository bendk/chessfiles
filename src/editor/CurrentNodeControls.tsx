import ArrowUpDown from "lucide-solid/icons/arrow-up-down";
import SquarePlus from "lucide-solid/icons/square-plus";
import PrevIcon from "lucide-solid/icons/chevron-left";
import NextIcon from "lucide-solid/icons/chevron-right";
import Tags from "lucide-solid/icons/tags";
import Trash from "lucide-solid/icons/trash-2";
import type { DateValue } from "@ark-ui/solid";
import { DatePicker, Field, parseDate } from "@ark-ui/solid";
import { Nag, nagText } from "~/lib/chess";
import { Priority } from "~/lib/node";
import type { Editor } from "~/lib/editor";
import type { EditorView } from "~/lib/editor";
import { createSignal, Index, Match, Show, Switch } from "solid-js";
import { Portal } from "solid-js/web";
import { Button } from "../Button";
import { MenuButton } from "../Menu";

export interface CurrentNodeControlsProps {
  isRoot: boolean;
  view: EditorView;
  setView: (view: EditorView) => void;
  editor: Editor;
  setDraftComment: (comment: string) => void;
  commitDraftComment: () => void;
  toggleNag: (nag: Nag) => void;
  setPriority: (priority: Priority) => void;
  deleteLine: () => void;
  addLine: () => void;
}

export function CurrentNodeControls(props: CurrentNodeControlsProps) {
  const item = (nag: Nag, cssClass?: string) => ({
    text: nagText(nag),
    value: nag.toString(),
    selected: props.view.currentNode.nags.indexOf(nag) != -1,
    cssClass,
  });

  return (
    <Show
      when={!props.view.currentNode.isDraft}
      fallback={
        <Button
          text="Add Line"
          icon={<SquarePlus />}
          onClick={props.addLine}
          style="flat"
        />
      }
    >
      <Switch>
        <Match when={props.isRoot}>
          <div class="flex flex-col gap-4">
            <h2 class="text-2xl">Game Info</h2>
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
            <textarea
              class="border-1 border-zinc-400 dark:border-zinc-700 rounded-sm w-full p-2"
              value={props.view.currentNode.comment}
              onInput={(evt) => props.setDraftComment(evt.target.value)}
              onChange={props.commitDraftComment}
              placeholder="game notes and search tags"
              rows="5"
            ></textarea>
          </div>
        </Match>
        <Match when={!props.isRoot}>
          <div class="flex flex-col gap-4 h-full justify-end">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <MenuButton
                  placement="top-end"
                  style="nags"
                  icon=<Tags />
                  items={[
                    item(Nag.BrilliantMove, "row-start-2"),
                    item(Nag.GoodMove),
                    item(Nag.InterestingMove),
                    item(Nag.DubiousMove),
                    item(Nag.PoorMove),
                    item(Nag.BlunderMove),

                    item(Nag.PlusOverMinusPosition, "row-start-1"),
                    item(Nag.PlusMinusPosition),
                    item(Nag.PlusEqualsPosition),
                    item(Nag.EqualPosition),
                    item(Nag.UnclearPosition),
                    item(Nag.EqualsPlusPosition),
                    item(Nag.MinusPlusPosition),
                    item(Nag.MinusOverPlusPosition),
                  ]}
                  onSelect={(nag) => props.toggleNag(Number.parseInt(nag))}
                />
                <MenuButton
                  placement="top-end"
                  style="flat"
                  icon=<ArrowUpDown />
                  items={[
                    {
                      text: "Priority: First",
                      value: Priority.TrainFirst.toString(),
                      selected:
                        props.view.currentNode.priority == Priority.TrainFirst,
                    },
                    {
                      text: "Priority: Default",
                      value: Priority.Default.toString(),
                      selected:
                        props.view.currentNode.priority == Priority.Default,
                    },
                    {
                      text: "Priority: Last",
                      value: Priority.TrainLast.toString(),
                      selected:
                        props.view.currentNode.priority == Priority.TrainLast,
                    },
                  ]}
                  onSelect={(priority) =>
                    props.setPriority(Number.parseInt(priority))
                  }
                />
              </div>
              <Button
                icon={<Trash />}
                onClick={props.deleteLine}
                style="flat"
              />
            </div>
            <textarea
              class="border-1 border-zinc-400 dark:border-zinc-700 rounded-sm w-full p-2"
              value={props.view.currentNode.comment}
              onInput={(evt) => props.setDraftComment(evt.target.value)}
              onChange={props.commitDraftComment}
              placeholder="move comment"
              rows="3"
            ></textarea>
          </div>
        </Match>
      </Switch>
    </Show>
  );
}

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
    <Field.Root class="flex flex-col gap-1">
      <Field.Label>{props.label}</Field.Label>
      <Field.Input
        value={props.view.headers.get(props.key)}
        onChange={(evt) => setValue(evt.target.value)}
        onKeyUp={(evt) => {
          if (evt.key == "Enter") {
            evt.currentTarget.blur();
          }
        }}
        class="border-1 border-zinc-400 dark:border-zinc-700 rounded-md px-2 py-1 outline-0"
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
    <Field.Root class="flex flex-col gap-1">
      <Field.Label>Result</Field.Label>
      <div class="flex">
        <MenuButton
          textSize="text-md"
          placement="top-start"
          text={props.view.headers.get("Result")}
          items={possibleValues.map((value) => ({
            text: value,
            value,
            selected: props.view.headers.get("Result") == value,
          }))}
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
  function parsePgnDate(value: string | undefined): DateValue | undefined {
    if (value === undefined || value == "????.??.??") {
      return undefined;
    }
    return parseDate(value.replace(/\./g, "-"));
  }

  function formatPgnDate(date: DateValue): string {
    return `${date.year.toString().padStart(4, "0")}.${date.month.toString().padStart(2, "0")}.${date.day.toString().padStart(2, "0")}`;
  }

  const [error, setError] = createSignal("");
  const [value, setValue] = createSignal(
    parsePgnDate(props.view.headers.get("Date")),
  );
  const valueAsArray = () => {
    const v = value();
    return v !== undefined ? [v] : undefined;
  };

  return (
    <DatePicker.Root
      value={valueAsArray()}
      format={formatPgnDate}
      onValueChange={({ value }) => {
        props.editor.setHeaderValue(
          "Date",
          value[0] ? formatPgnDate(value[0]) : undefined,
        );
        props.setView(props.editor.view);
        setError("");
      }}
    >
      <DatePicker.Label>Date</DatePicker.Label>

      <DatePicker.Control class="flex items-center justify-between gap-4">
        <input
          type="text"
          value={props.view.headers.get("Date")}
          placeholder="YYYY.MM.DD"
          onChange={(evt) => {
            let date;
            try {
              date = parsePgnDate(evt.target.value);
            } catch {
              setError("expected YYYY.MM.DD");
              return;
            }
            setError("");
            setValue(date);
            props.editor.setHeaderValue(
              "Date",
              date ? formatPgnDate(date) : undefined,
            );
            props.setView(props.editor.view);
          }}
          onKeyUp={(evt) => {
            if (evt.key == "Enter") {
              evt.currentTarget.blur();
            }
          }}
          class="border-1 border-zinc-700 rounded-md px-2 py-1 outline-0"
        />
        <DatePicker.Trigger class="text-3xl cursor-pointer">
          📅
        </DatePicker.Trigger>
      </DatePicker.Control>
      <div class="text-rose-500 pl-1 pt-0.5">{error()}</div>

      <Portal>
        <DatePicker.Positioner>
          <DatePicker.Content class="bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 p-4 border-1 border-zinc-400 dark:border-zinc-700">
            <DatePicker.View view="day">
              <DatePicker.Context>
                {(context) => (
                  <>
                    <DatePicker.ViewControl class="flex items-center w-full pb-4">
                      <DatePicker.PrevTrigger class="cursor-pointer hover:text-white hover:bg-sky-400 dark:hover:bg-sky-800 py-2 px-2 rounded-md">
                        <PrevIcon />
                      </DatePicker.PrevTrigger>
                      <div class="grow flex justify-center">
                        <DatePicker.ViewTrigger class="cursor-pointer hover:text-white hover:bg-sky-400 dark:hover:bg-sky-800 py-2 px-4 rounded-md">
                          <DatePicker.RangeText />
                        </DatePicker.ViewTrigger>
                      </div>
                      <DatePicker.NextTrigger class="cursor-pointer hover:text-white hover:bg-sky-400 dark:hover:bg-sky-800 py-2 px-2 rounded-md">
                        <NextIcon />
                      </DatePicker.NextTrigger>
                    </DatePicker.ViewControl>

                    <DatePicker.Table class="w-80">
                      <DatePicker.TableHead>
                        <DatePicker.TableRow>
                          <Index each={context().weekDays}>
                            {(weekDay) => (
                              <DatePicker.TableHeader class="p-2">
                                {weekDay().short}
                              </DatePicker.TableHeader>
                            )}
                          </Index>
                        </DatePicker.TableRow>
                      </DatePicker.TableHead>

                      <DatePicker.TableBody>
                        <Index each={context().weeks}>
                          {(week) => (
                            <DatePicker.TableRow>
                              <Index each={week()}>
                                {(day) => (
                                  <DatePicker.TableCell value={day()}>
                                    <DatePicker.TableCellTrigger class="p-2 text-center cursor-pointer hover:text-white hover:bg-sky-400 dark:hover:bg-sky-800 rounded-md">
                                      {day().day}
                                    </DatePicker.TableCellTrigger>
                                  </DatePicker.TableCell>
                                )}
                              </Index>
                            </DatePicker.TableRow>
                          )}
                        </Index>
                      </DatePicker.TableBody>
                    </DatePicker.Table>
                  </>
                )}
              </DatePicker.Context>
            </DatePicker.View>

            <DatePicker.View view="month">
              <DatePicker.Context>
                {(context) => (
                  <>
                    <DatePicker.ViewControl class="flex items-center w-full pb-6">
                      <DatePicker.PrevTrigger class="cursor-pointer hover:text-white hover:bg-sky-400 dark:hover:bg-sky-800 py-2 px-2 rounded-md">
                        <PrevIcon />
                      </DatePicker.PrevTrigger>
                      <div class="grow flex justify-center">
                        <DatePicker.ViewTrigger class="cursor-pointer hover:text-white hover:bg-sky-400 dark:hover:bg-sky-800 py-2 px-4 rounded-md">
                          <DatePicker.RangeText />
                        </DatePicker.ViewTrigger>
                      </div>
                      <DatePicker.NextTrigger class="cursor-pointer hover:text-white hover:bg-sky-400 dark:hover:bg-sky-800 py-2 px-2 rounded-md">
                        <NextIcon />
                      </DatePicker.NextTrigger>
                    </DatePicker.ViewControl>

                    <DatePicker.Table class="w-80">
                      <DatePicker.TableBody>
                        <Index
                          each={context().getMonthsGrid({
                            columns: 4,
                            format: "short",
                          })}
                        >
                          {(months) => (
                            <DatePicker.TableRow>
                              <Index each={months()}>
                                {(month) => (
                                  <DatePicker.TableCell value={month().value}>
                                    <DatePicker.TableCellTrigger class="p-2 text-center cursor-pointer hover:text-white hover:bg-sky-400 dark:hover:bg-sky-800 rounded-md">
                                      {month().label}
                                    </DatePicker.TableCellTrigger>
                                  </DatePicker.TableCell>
                                )}
                              </Index>
                            </DatePicker.TableRow>
                          )}
                        </Index>
                      </DatePicker.TableBody>
                    </DatePicker.Table>
                  </>
                )}
              </DatePicker.Context>
            </DatePicker.View>

            <DatePicker.View view="year">
              <DatePicker.Context>
                {(context) => (
                  <>
                    <DatePicker.ViewControl class="flex items-center w-full pb-6">
                      <DatePicker.PrevTrigger class="cursor-pointer hover:text-white hover:bg-sky-400 dark:hover:bg-sky-800 py-2 px-2 rounded-md">
                        <PrevIcon />
                      </DatePicker.PrevTrigger>
                      <div class="grow flex justify-center">
                        <DatePicker.ViewTrigger class="cursor-pointer hover:text-white hover:bg-sky-400 dark:hover:bg-sky-800 py-2 px-4 rounded-md">
                          <DatePicker.RangeText />
                        </DatePicker.ViewTrigger>
                      </div>
                      <DatePicker.NextTrigger class="cursor-pointer hover:text-white hover:bg-sky-400 dark:hover:bg-sky-800 py-2 px-2 rounded-md">
                        <NextIcon />
                      </DatePicker.NextTrigger>
                    </DatePicker.ViewControl>

                    <DatePicker.Table class="w-80">
                      <DatePicker.TableBody>
                        <Index each={context().getYearsGrid({ columns: 4 })}>
                          {(years) => (
                            <DatePicker.TableRow>
                              <Index each={years()}>
                                {(year) => (
                                  <DatePicker.TableCell value={year().value}>
                                    <DatePicker.TableCellTrigger class="p-2 text-center cursor-pointer hover:text-white hover:bg-sky-400 dark:hover:bg-sky-800 rounded-md">
                                      {year().label}
                                    </DatePicker.TableCellTrigger>
                                  </DatePicker.TableCell>
                                )}
                              </Index>
                            </DatePicker.TableRow>
                          )}
                        </Index>
                      </DatePicker.TableBody>
                    </DatePicker.Table>
                  </>
                )}
              </DatePicker.Context>
            </DatePicker.View>
          </DatePicker.Content>
        </DatePicker.Positioner>
      </Portal>
    </DatePicker.Root>
  );
}

//   <Field.Root
//     class="flex flex-col gap-1"
//     invalid={error() != ""}
//   >
//     <Field.Label>Date</Field.Label>
//     <Field.Input
//       value={props.view.headers.get("Date")}
//       onChange={(evt) => setValue(evt.target.value)}
//       onKeyUp={(evt) => {
//         if (evt.key == "Enter") {
//           evt.currentTarget.blur();
//         }
//       }}
//       class="border-1 border-zinc-700 rounded-md px-2 py-1 outline-0"
//     />
//     <Field.ErrorText class="text-rose-500">{error()}</Field.ErrorText>
//   </Field.Root>
// );
///}
