import ArrowBigLeft from "lucide-solid/icons/arrow-left";
import ArrowBigRight from "lucide-solid/icons/arrow-right";
import LogOut from "lucide-solid/icons/log-out";
import Redo from "lucide-solid/icons/redo";
import Save from "lucide-solid/icons/save";
import Undo from "lucide-solid/icons/undo";
import type { Move, Nag } from "~/lib/chess";
import { pgnToString } from "~/lib/chess";
import type { RootNode } from "~/lib/node";
import { Editor as EditorBackend } from "~/lib/editor";
import { createSignal, Show } from "solid-js";
import { Board } from "./Board";
import { CurrentNodeControls } from "./CurrentNodeControls";
import { Button } from "../Button";
import { Dialog } from "~/Dialog";
import { Line } from "./Line";

interface EditorProps {
  rootNode: RootNode;
  onSave: (content: string) => Promise<boolean>;
  onExit: () => void;
  fen?: string;
}

export function Editor(props: EditorProps) {
  const editor = new EditorBackend(props.rootNode);
  const [view, setView] = createSignal(editor.view);
  const [draftComment, setDraftComment] = createSignal<string>();
  const [confirmExitDialog, setConfirmExitDialog] = createSignal(false);

  function onMove(move: Move) {
    editor.move(move);
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

  function undo() {
    editor.undo();
    setView(editor.view);
  }

  function redo() {
    editor.redo();
    setView(editor.view);
  }

  async function save() {
    const data = pgnToString(editor.rootNode.export());
    if (await props.onSave(data)) {
      editor.clearUndo();
      setView(editor.view);
    }
  }

  function exit() {
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
    <div class="flex justify-center pt-4">
      <div class="flex gap-4">
        <div class="w-100 flex flex-col-reverse h-200 gap-4">
          <CurrentNodeControls
            isRoot={view().ply == 0}
            currentNode={view().currentNode}
            setDraftComment={setDraftComment}
            commitDraftComment={commitDraftComment}
            toggleNag={toggleNag}
            deleteLine={deleteLine}
            addLine={addLine}
          />
        </div>
        <div class="w-200 flex-col">
          <div class="flex pb-2 justify-between">
            <div class="flex gap-2">
              <Button
                icon={<Save />}
                text="Save"
                disabled={!view().canUndo}
                onClick={save}
                narrow
              />
              <Button icon={<LogOut />} text="Exit" onClick={exit} narrow />
            </div>
            <div class="flex gap-2">
              <Button
                disabled={!view().canRedo}
                icon={<Redo />}
                onClick={redo}
                narrow
              />
              <Button
                disabled={!view().canUndo}
                icon={<Undo />}
                onClick={undo}
                narrow
              />
            </div>
          </div>
          <div class="h-200">
            <Board
              chess={view().position}
              onMove={onMove}
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
          withCancel
        >
          <div>There are unsaved changes, are you sure you want to exit?</div>
        </Dialog>
      </Show>
    </div>
  );
}
