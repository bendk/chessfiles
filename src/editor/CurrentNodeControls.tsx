import ArrowUpDown from "lucide-solid/icons/arrow-up-down";
import Tags from "lucide-solid/icons/tags";
import { Nag, nagText } from "~/lib/chess";
import { Field } from "@ark-ui/solid";
import type { RootNode } from "~/lib/node";
import { RootNodeType } from "~/lib/node";
import type { Editor, EditorView } from "~/lib/editor";
import { createMemo, Match, Switch } from "solid-js";
import { menuItem, Button, MenuButton } from "~/components";
import type { ReorderMenuItems, ReorderMoves } from "./Editor";

export interface CurrentNodeControlsProps {
  isRoot: boolean;
  rootNode: RootNode;
  view: EditorView;
  setView: (view: EditorView) => void;
  editor: Editor;
  setDraftComment: (comment: string) => void;
  commitDraftComment: () => void;
  toggleNag: (nag: Nag) => void;
  reorderMenuItems: ReorderMenuItems;
  onContextMenuAction: ReorderMoves;
  onSetInitialPosition: () => void;
}

export function CurrentNodeControls(props: CurrentNodeControlsProps) {
  const item = (nag: Nag, cssClass?: string) =>
    menuItem(nag.toString(), nagText(nag), {
      selected: props.view.currentNode.nags.indexOf(nag) != -1,
      cssClass,
    });

  function setTrainingColor(color: string | null) {
    if (color == "white" || color == "black") {
      props.editor.setTrainingColor(color);
    } else {
      props.editor.setTrainingColor(undefined);
    }
    props.setView(props.editor.view);
  }

  function trainingColorLabel() {
    if (props.view.color == "white") {
      return "Training: white";
    } else if (props.view.color == "black") {
      return "Training: black";
    } else {
      return "Training: both sides";
    }
  }

  const reorderButton = createMemo(() => {
    const currentNode = props.view.currentNode;
    if (currentNode.siblingCount < 2) {
      return null;
    }
    return (
      <MenuButton
        placement="bottom-end"
        style="flat"
        icon=<ArrowUpDown />
        items={props.reorderMenuItems([...currentNode.movesToNode])}
        onSelect={(op) => {
          if (currentNode.move === null) {
            console.error("currentNode.move is null");
            return;
          }
          props.onContextMenuAction([...currentNode.movesToNode], op);
        }}
      />
    );
  });

  return (
    <Switch>
      <Match when={props.isRoot && props.rootNode.type == RootNodeType.Normal}>
        <div class="flex flex-col gap-4 grow h-full pb-4">
          <Field.Root class="flex flex-col gap-1">
            <Field.Label>Game notes</Field.Label>
            <Field.Textarea
              value={props.view.rootComment}
              onInput={(evt) => {
                props.setDraftComment(evt.target.value);
              }}
              onChange={props.commitDraftComment}
              onKeyUp={(evt) => {
                if (evt.key == "Enter") {
                  evt.currentTarget.blur();
                }
              }}
              class="border-1 border-fg-3 rounded-md px-2 py-1 outline-0"
              rows="5"
            />
          </Field.Root>
          <div class="flex gap-4 grow items-end justify-start">
            <Button
              text="Set initial position"
              onClick={props.onSetInitialPosition}
            />
          </div>
        </div>
      </Match>
      <Match
        when={props.isRoot && props.rootNode.type == RootNodeType.Training}
      >
        <div class="flex flex-col gap-4">
          <div class="italic">
            Add moves that you want to memorize. Train them later from the
            Training page.
          </div>
          <div class="flex gap-16">
            <div class="w-80">
              <MenuButton
                text={trainingColorLabel()}
                items={[
                  {
                    type: "item",
                    value: "white",
                    text: "White",
                    selected: props.view.color == "white",
                  },
                  {
                    type: "item",
                    value: "black",
                    text: "Black",
                    selected: props.view.color == "black",
                  },
                  {
                    type: "item",
                    value: "both",
                    text: "Both sides",
                    selected: props.view.color === undefined,
                  },
                ]}
                onSelect={setTrainingColor}
              />
            </div>
            <Button
              text="Change initial position"
              onClick={props.onSetInitialPosition}
            />
          </div>
        </div>
      </Match>
      <Match when={!props.isRoot}>
        <div class="flex flex-col h-full">
          <h2 class="text-lg text-fg-2">Notes</h2>
          <textarea
            class="border-1 border-fg-3 rounded-sm w-full p-2"
            value={props.view.currentNode.comment}
            onInput={(evt) => {
              props.setDraftComment(evt.target.value);
            }}
            onChange={props.commitDraftComment}
            rows="3"
          ></textarea>
          <div class="pt-4 flex items-center justify-start">
            <MenuButton
              placement="bottom-start"
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
            {reorderButton()}
          </div>
        </div>
      </Match>
    </Switch>
  );
}
