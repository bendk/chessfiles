import ArrowBigLeft from "lucide-solid/icons/arrow-left";
import ArrowBigRight from "lucide-solid/icons/arrow-right";
import LogOut from "lucide-solid/icons/log-out";
import Redo from "lucide-solid/icons/redo";
import Save from "lucide-solid/icons/save";
import MenuIcon from "lucide-solid/icons/menu";
import Undo from "lucide-solid/icons/undo";
import Settings from "lucide-solid/icons/settings";
import type { Color, Move, Nag, Shape } from "~/lib/chess";
import { pgnToString } from "~/lib/chess";
import type { Priority } from "~/lib/node";
import type { RootNode } from "~/lib/node";
import { Editor as EditorBackend } from "~/lib/editor";
import { createSignal, Show } from "solid-js";
import { Board } from "./Board";
import { CurrentNodeControls } from "./CurrentNodeControls";
import { Button } from "../Button";
import { SimpleDialog } from "~/Dialog";
import { Line } from "./Line";
import { EditorDialog } from "./EditorDialog";
import { Navbar } from "~/Navbar";
import { Menu } from "~/Menu";

interface EditorProps {
  rootNode: RootNode;
  filename: string;
  onSave: (content: string) => Promise<boolean>;
  onExit: () => void;
  fen?: string;
}

export function Editor(props: EditorProps) {
  const editor = new EditorBackend(props.rootNode);
  const [settingsDialag, setSettingsDialog] = createSignal(false);
  const [view, setView] = createSignal(editor.view);
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

  function setTrainingColor(color: Color | undefined) {
    editor.setTrainingColor(color);
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

  async function onMenuSelect(value: string) {
    if (value == "save") {
      const data = pgnToString(editor.rootNode.export());
      if (await props.onSave(data)) {
        editor.clearUndo();
        setView(editor.view);
      }
    } else if (value == "settings") {
      setSettingsDialog(true);
    } else if (value == "exit") {
      if (editor.view.canUndo) {
        setConfirmExitDialog(true);
      } else {
        props.onExit();
      }
    }
  }

  function onExitSubmit() {
    setConfirmExitDialog(false);
    props.onExit();
  }

  return (
    <div class="flex-col justify-center mx-auto">
      <Navbar class="flex items-center justify-between gap-4">
        <div class="flex-col gap-2">
          <div class="flex gap-2">
            <Menu
              onSelect={(value) => onMenuSelect(value)}
              elt=<MenuIcon />
              items={[
                {
                  text: "Save",
                  icon: <Save />,
                  value: "save",
                  disabled: !view().canUndo,
                },
                {
                  text: "Settings",
                  icon: <Settings />,
                  value: "settings",
                },
                {
                  text: "Exit",
                  icon: <LogOut />,
                  value: "exit",
                },
              ]}
            ></Menu>
          </div>
        </div>
        <div class="text-lg truncate text-ellipsis">{props.filename} </div>
        <div class="flex gap-2">
          <Button
            disabled={!view().canRedo}
            icon={<Redo />}
            title="Redo"
            onClick={redo}
            style="flat"
          />
          <Button
            disabled={!view().canUndo}
            icon={<Undo />}
            title="Undo"
            onClick={undo}
            style="flat"
          />
        </div>
      </Navbar>
      <div class="flex gap-4">
        <div class="w-100 flex flex-col-reverse h-200 gap-4">
          <CurrentNodeControls
            isRoot={view().ply == 0}
            currentNode={view().currentNode}
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
      <Show when={settingsDialag()} keyed>
        <EditorDialog
          view={view()}
          onSubmit={(color) => {
            setTrainingColor(color);
            setSettingsDialog(false);
          }}
          onClose={() => setSettingsDialog(false)}
        />
      </Show>
      <Show when={confirmExitDialog()} keyed>
        <SimpleDialog
          onSubmit={onExitSubmit}
          onClose={() => setConfirmExitDialog(false)}
          title="Confirm exit"
          submitText="Exit"
        >
          <div>There are unsaved changes, are you sure you want to exit?</div>
        </SimpleDialog>
      </Show>
    </div>
  );
}
