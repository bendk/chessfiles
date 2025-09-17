import ArrowBigLeft from "lucide-solid/icons/arrow-left";
import ArrowBigRight from "lucide-solid/icons/arrow-right";
import LogOut from "lucide-solid/icons/log-out";
import Redo from "lucide-solid/icons/redo";
import Save from "lucide-solid/icons/save";
import Undo from "lucide-solid/icons/undo";
import Settings from "lucide-solid/icons/settings";
import type { Move, Nag, Shape } from "~/lib/chess";
import type { Priority, RootNode } from "~/lib/node";
import { Editor as EditorBackend } from "~/lib/editor";
import { createMemo, createSignal, Show } from "solid-js";
import { Button, Dialog, MenuButton } from "~/components";
import { CurrentNodeControls } from "./CurrentNodeControls";
import { Board } from "./Board";
import { Line } from "./Line";

interface EditorProps {
  rootNode: RootNode;
  name: string;
  onSave: () => Promise<boolean>;
  onExit: () => void;
  fen?: string;
}

export function Editor(props: EditorProps) {
  const editor = new EditorBackend(props.rootNode);
  const [view, setView] = createSignal(editor.view);
  const [saving, setSaving] = createSignal(false);
  const [draftComment, setDraftComment] = createSignal<string>();
  const [confirmExitDialog, setConfirmExitDialog] = createSignal(false);

  function onMove(move: Move) {
    editor.move(move);
    setView(editor.view);
  }

  function toggleShape(shape: Shape) {
    editor.toggleShape(shape);
    setView(editor.view);
  }

  function commitDraftComment() {
    const comment = draftComment();
    if (comment !== undefined) {
      editor.setComment(comment);
      setDraftComment(undefined);
      setView(editor.view);
    }
  }

  function setMoves(moves: readonly Move[]) {
    commitDraftComment();
    editor.setMoves(moves);
    setView(editor.view);
  }

  function moveBackwards() {
    commitDraftComment();
    editor.moveBackwards();
    setView(editor.view);
  }

  function moveForwards() {
    commitDraftComment();
    editor.moveForwards();
    setView(editor.view);
  }

  function addLine() {
    editor.addLine();
    setView(editor.view);
  }

  function deleteLine() {
    editor.deleteLine();
    setView(editor.view);
  }

  function toggleNag(nag: Nag) {
    editor.toggleNag(nag);
    setView(editor.view);
  }

  function setPriority(priority: Priority) {
    editor.setPriority(priority);
    setView(editor.view);
  }

  const trainingColorText = createMemo(() => {
    const color = view().color;
    if (color == "white") {
      return "White";
    } else if (color == "black") {
      return "Black";
    } else {
      return "Both";
    }
  });

  function setTrainingColor(color: string | undefined) {
    if (color == "white") {
      editor.setTrainingColor("white");
    } else if (color == "black") {
      editor.setTrainingColor("black");
    } else {
      editor.setTrainingColor(undefined);
    }
    setView(editor.view);
  }

  function undo() {
    editor.undo();
    setView(editor.view);
  }

  function redo() {
    editor.redo();
    setView(editor.view);
  }

  async function onSave() {
    setSaving(true);
    try {
      if (await props.onSave()) {
        editor.clearUndo();
        setView(editor.view);
      }
    } finally {
      setSaving(false);
    }
  }

  function onExit() {
    if (editor.view.canUndo) {
      setConfirmExitDialog(true);
    } else {
      props.onExit();
    }
  }

  function onExitSubmit() {
    setConfirmExitDialog(false);
    props.onExit();
  }

  return (
    <div class="flex-col justify-center mx-auto">
      <div class="flex justify-between pt-4 pb-8 px-8">
        <div class="text-3xl truncate text-ellipsis">
          Editing: {props.name}{" "}
        </div>
        <div class="flex gap-8">
          <div class="flex">
            <Button
              disabled={!view().canUndo}
              icon={<Undo />}
              title="Undo"
              onClick={undo}
              style="flat"
            />
            <Button
              disabled={!view().canRedo}
              icon={<Redo />}
              title="Redo"
              onClick={redo}
              style="flat"
            />
          </div>
          <MenuButton
            text={`Side: ${trainingColorText()}`}
            icon={<Settings />}
            style="flat"
            items={[
              {
                text: "White",
                value: "white",
                selected: view().color == "white",
              },
              {
                text: "Black",
                value: "black",
                selected: view().color == "black",
              },
              {
                text: "Both",
                value: "both",
                selected: view().color === undefined,
              },
            ]}
            onSelect={setTrainingColor}
          />
          <div class="flex">
            <Button
              text="Save"
              icon={<Save />}
              onClick={onSave}
              disabled={!view().canUndo}
              style="flat"
            />
            <Button
              text="Exit"
              icon={<LogOut />}
              disabled={saving()}
              onClick={onExit}
              style="flat"
            />
          </div>
        </div>
      </div>
      <div class="flex gap-4">
        <div class="w-80 h-200">
          <CurrentNodeControls
            isRoot={view().ply == 0}
            view={view()}
            editor={editor}
            setView={setView}
            setDraftComment={setDraftComment}
            commitDraftComment={commitDraftComment}
            toggleNag={toggleNag}
            deleteLine={deleteLine}
            setPriority={setPriority}
            addLine={addLine}
          />
        </div>
        <div class="w-200 flex-col">
          <div class="h-200">
            <Board
              chess={view().position}
              lastMove={view().lastMove}
              onMove={onMove}
              enableShapes={view().ply > 0 && !view().currentNode.isDraft}
              toggleShape={toggleShape}
              shapes={view().currentNode.shapes}
              onMoveBackwards={moveBackwards}
              onMoveForwards={moveForwards}
            />
          </div>
          <div class="p-2 flex justify-between">
            <button class="cursor-pointer" onClick={moveBackwards}>
              <ArrowBigLeft size={40} />
            </button>
            <button class="cursor-pointer" onClick={moveForwards}>
              <ArrowBigRight size={40} />
            </button>
          </div>
          <div class="p-2">
            <Line view={view()} setMoves={setMoves} />
          </div>
        </div>
        <div class="py-2 w-70">
          {
            // Maybe engine/db lines go here?
          }
        </div>
      </div>
      <Show when={confirmExitDialog()} keyed>
        <Dialog
          onSubmit={onExitSubmit}
          onClose={() => setConfirmExitDialog(false)}
          title="Confirm exit"
          submitText="Exit"
        >
          <div>There are unsaved changes, are you sure you want to exit?</div>
        </Dialog>
      </Show>
    </div>
  );
}
