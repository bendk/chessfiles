import ArrowBigLeft from "lucide-solid/icons/arrow-left";
import ArrowBigRight from "lucide-solid/icons/arrow-right";
import List from "lucide-solid/icons/list";
import ListTree from "lucide-solid/icons/list-tree";
import LogOut from "lucide-solid/icons/log-out";
import Redo from "lucide-solid/icons/redo";
import Save from "lucide-solid/icons/save";
import Undo from "lucide-solid/icons/undo";
import { SegmentGroup } from "@ark-ui/solid";
import type { Move, Nag, Shape } from "~/lib/chess";
import type { Priority, RootNode } from "~/lib/node";
import { BookType } from "~/lib/node";
import type { EditorView } from "~/lib/editor";
import { Editor as EditorBackend } from "~/lib/editor";
import { createSignal, Match, Show, Switch } from "solid-js";
import { Button, Dialog } from "~/components";
import { CurrentNodeControls } from "./CurrentNodeControls";
import { SelectInitialPosition } from "./SelectInitialPosition";
import { Board } from "./Board";
import { MoveList } from "./MoveList";
import { MoveTree } from "./MoveTree";

interface EditorProps {
  rootNode: RootNode;
  bookType: BookType;
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
  const [mode, setMode] = createSignal("");
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
    <>
      <Switch>
        <Match when={mode() == "set-initial-position"}>
          <SelectInitialPosition
            name={props.name}
            onSelect={(fen) => {
              console.log("select: ", fen);
              editor.setInitialPosition(fen);
              setView(editor.view);
              setMode("");
            }}
            onExit={() => setMode("")}
          />
        </Match>
        <Match when={true}>
          <div class="grid gap-4 grid-cols-[320px_1fr_320px] grid-rows-[52px_856px_1fr] px-4 py-2 h-screen">
            <div class="col-span-full">
              <Header
                name={props.name}
                bookType={props.bookType}
                view={view()}
                saving={saving()}
                undo={undo}
                redo={redo}
                onSave={onSave}
                onExit={onExit}
              />
            </div>
            <div>
              <CurrentNodeControls
                isRoot={view().ply == 0}
                bookType={props.bookType}
                view={view()}
                editor={editor}
                setView={setView}
                setDraftComment={setDraftComment}
                commitDraftComment={commitDraftComment}
                toggleNag={toggleNag}
                deleteLine={deleteLine}
                setPriority={setPriority}
                addLine={addLine}
                onSetInitialPosition={() => setMode("set-initial-position")}
              />
            </div>
            <div>
              <BoardView
                view={view()}
                onMove={onMove}
                toggleShape={toggleShape}
                moveBackwards={moveBackwards}
                moveForwards={moveForwards}
              />
            </div>
            <div>
              <RightSidebar />
            </div>
            <div class="col-2 flex min-w-0 min-h-0">
              <MoveView
                bookType={props.bookType}
                rootNode={props.rootNode}
                view={view()}
                setMoves={setMoves}
              />
            </div>
          </div>
        </Match>
      </Switch>
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
    </>
  );
}

interface HeaderProps {
  name: string;
  bookType: BookType;
  view: EditorView;
  saving: boolean;
  undo: () => void;
  redo: () => void;
  onSave: () => void;
  onExit: () => void;
}

function Header(props: HeaderProps) {
  return (
    <div class="flex justify-between">
      <div class="text-3xl truncate text-ellipsis">Editing: {props.name}</div>
      <div class="flex gap-8">
        <div class="flex">
          <Button
            disabled={!props.view.canUndo}
            icon={<Undo />}
            title="Undo"
            onClick={props.undo}
            style="flat"
          />
          <Button
            disabled={!props.view.canRedo}
            icon={<Redo />}
            title="Redo"
            onClick={props.redo}
            style="flat"
          />
        </div>
        <div class="flex">
          <Button
            text="Save"
            icon={<Save />}
            onClick={props.onSave}
            disabled={!props.view.canUndo}
            style="flat"
          />
          <Button
            text="Exit"
            icon={<LogOut />}
            disabled={props.saving}
            onClick={props.onExit}
            style="flat"
          />
        </div>
      </div>
    </div>
  );
}

interface BoardViewProps {
  view: EditorView;
  onMove: (move: Move) => void;
  toggleShape: (shape: Shape) => void;
  moveBackwards: () => void;
  moveForwards: () => void;
}

function BoardView(props: BoardViewProps) {
  return (
    <div class="flex flex-col w-200 mx-auto">
      <div class="w-200 h-200">
        <Board
          chess={props.view.position}
          lastMove={props.view.lastMove}
          onMove={props.onMove}
          enableShapes={props.view.ply > 0 && !props.view.currentNode.isDraft}
          toggleShape={props.toggleShape}
          shapes={props.view.currentNode.shapes}
          onMoveBackwards={props.moveBackwards}
          onMoveForwards={props.moveForwards}
        />
      </div>
      <div class="p-2 flex justify-between">
        <button class="cursor-pointer" onClick={props.moveBackwards}>
          <ArrowBigLeft size={40} />
        </button>
        <button class="cursor-pointer" onClick={props.moveForwards}>
          <ArrowBigRight size={40} />
        </button>
      </div>
    </div>
  );
}

interface MoveViewProps {
  bookType: BookType;
  rootNode: RootNode;
  view: EditorView;
  setMoves: (moves: readonly Move[]) => void;
}

function MoveView(props: MoveViewProps) {
  const [moveView, setMoveView] = createSignal(
    props.bookType == BookType.Opening ? "tree" : "list",
  );
  return (
    <div class="flex flex-col min-h-full min-w-full">
      <div class="flex justify-end pb-2">
        <SegmentGroup.Root
          value={moveView()}
          class="flex relative bg-zinc-800 rounded-md"
          onValueChange={(details) => setMoveView(details.value ?? "list")}
        >
          <SegmentGroup.Indicator
            class="bg-sky-500 opacity-30"
            classList={{
              "rounded-l-md": moveView() == "list",
              "rounded-r-md": moveView() == "tree",
            }}
            style="left: var(--left); top: var(--top); width: var(--width); height: var(--height)"
          />
          <SegmentGroup.Item value="list" class="px-2 py-1 cursor-pointer">
            <SegmentGroup.ItemText>
              <List size={20} />
            </SegmentGroup.ItemText>
            <SegmentGroup.ItemControl />
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
          <SegmentGroup.Item value="tree" class="px-2 py-1 cursor-pointer">
            <SegmentGroup.ItemText>
              <ListTree size={20} />
            </SegmentGroup.ItemText>
            <SegmentGroup.ItemControl />
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        </SegmentGroup.Root>
      </div>
      <div class="pr-2 min-h-0 min-w-0 grow overflow-auto">
        <Switch>
          <Match when={moveView() == "list"}>
            <MoveList
              rootNode={props.rootNode}
              view={props.view}
              setMoves={props.setMoves}
            />
          </Match>
          <Match when={moveView() == "tree"}>
            <MoveTree view={props.view} setMoves={props.setMoves} />
          </Match>
        </Switch>
      </div>
    </div>
  );
}

function RightSidebar() {
  // Maybe engine/db lines go here?
  return <div />;
}
