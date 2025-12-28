import LogOut from "lucide-solid/icons/log-out";
import Redo from "lucide-solid/icons/redo";
import Save from "lucide-solid/icons/save";
import Settings from "lucide-solid/icons/settings";
import Undo from "lucide-solid/icons/undo";
import { moveEquals } from "~/lib/chess";
import type { Move, Nag, Shape } from "~/lib/chess";
import type { RootNode } from "~/lib/node";
import { RootNodeType } from "~/lib/node";
import type { EditorView } from "~/lib/editor";
import { Editor as EditorBackend } from "~/lib/editor";
import {
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Match,
  Switch,
} from "solid-js";
import type { MenuItem } from "~/components";
import { menuItem, Button, Dialog, MenuButton } from "~/components";
import { CurrentNodeControls } from "./CurrentNodeControls";
import { SelectInitialPosition } from "./SelectInitialPosition";
import { GameDialog } from "./GameDialog";
import { GameInfo } from "./GameInfo";
import { Board } from "./Board";
import { Book } from "./Book";
import { Engine } from "./Engine";
import { GameViewMoves } from "./GameViewMoves";
import { LineViewMoves } from "./LineViewMoves";

export type ReorderMenuItems = (moves: readonly Move[]) => MenuItem[];
export type ReorderMoves = (moves: readonly Move[], op: string) => void;
export type ReorderOp = "main" | "up" | "down";

interface EditorProps {
  rootNode: RootNode;
  name: string;
  onSave: () => Promise<boolean>;
  onExit: () => void;
}

type DialogInfo =
  | {
      type: "confirm-exit";
    }
  | {
      type: "game";
      pgn: string;
    };

export function Editor(props: EditorProps) {
  const editor = new EditorBackend(props.rootNode);
  const [view, setView] = createSignal(editor.view);
  const [saving, setSaving] = createSignal(false);
  const [draftComment, setDraftComment] = createSignal<string>();
  const [mode, setMode] = createSignal("");
  const [dialog, setDialog] = createSignal<DialogInfo | null>(null);
  const [moveView, setMoveView] = createSignal(
    props.rootNode.type == RootNodeType.Training ? "game" : "line",
  );

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
    if (moveView() == "line") {
      editor.moveBackward();
    } else {
      editor.moveBackwardGameView();
    }
    setView(editor.view);
  }

  function moveForwards() {
    commitDraftComment();
    if (moveView() == "line") {
      editor.moveForward();
    } else {
      editor.moveForwardGameView();
    }
    setView(editor.view);
  }

  function deleteNode() {
    editor.deleteNode();
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

  function reorderMenuItems(moves: readonly Move[]) {
    const move = moves.at(-1);
    if (move === undefined) {
      console.error("reorderMenuItems: move list empty");
      return [];
    }
    const movesToParent = moves.slice(0, -1);
    const node =
      movesToParent.length > 0
        ? props.rootNode.getDescendant(movesToParent)
        : props.rootNode;
    if (node === undefined) {
      console.error("reorderMenuItems: node lookup failed", movesToParent);
      return [];
    }
    const parentMoves = node.children.map((n) => n.move);
    const index = parentMoves.findIndex((m) => moveEquals(m, move));
    const items = [];
    if (index > 0) {
      items.push(menuItem("main", "Make main line"));
    }
    if (index > 1) {
      items.push(menuItem("up", "Move variation up"));
    }
    if (index < parentMoves.length - 1) {
      items.push(menuItem("down", "Move variation down"));
    }
    return items;
  }

  function onReorder(moves: readonly Move[], op: string) {
    const move = moves.at(-1);
    if (move === undefined) {
      console.error("reorderMenuItems: move list empty");
      return [];
    }
    const movesToParent = moves.slice(0, -1);
    const node =
      movesToParent.length > 0
        ? props.rootNode.getDescendant(movesToParent)
        : props.rootNode;
    if (node === undefined) {
      console.error("onReorder: node lookup failed", movesToParent);
      return;
    }
    const parentMoves = node.children.map((n) => n.move);
    const index = parentMoves.findIndex((m) => moveEquals(m, move));
    const newMoves = [...parentMoves];
    newMoves.splice(index, 1);

    if (op == "main") {
      newMoves.splice(0, 0, move);
    } else if (op == "up") {
      newMoves.splice(index - 1, 0, move);
    } else if (op == "down") {
      newMoves.splice(index + 1, 0, move);
    } else {
      console.error("Invalid reorder op: ", op);
    }
    editor.setMoves([...movesToParent, move]);
    editor.reorderMoves(newMoves);
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
      setDialog({ type: "confirm-exit" });
    } else {
      props.onExit();
    }
  }

  function onExitSubmit() {
    setDialog(null);
    props.onExit();
  }

  // Calculated from:  header: 76, footer: 200, controls: 52
  const boardMaxHeight = "100vh - 328px";

  // Calculated from:  left-sidebar: 320, right-sidebar: 400px
  const boardMaxWidth = "100vw - 720px";

  const boardSize = `width: calc(min(${boardMaxHeight}, ${boardMaxWidth})); height: calc(min(${boardMaxHeight}, ${boardMaxWidth}) + 52px);`;

  onMount(() => {
    window.onbeforeunload = () => {
      if (editor.view.canUndo) {
        return "Are you sure you want to leave, there are unsaved changes";
      }
    };
  });
  onCleanup(() => {
    window.onbeforeunload = null;
  });

  const openDialog = createMemo(() => {
    const d = dialog();
    if (d?.type == "confirm-exit") {
      return (
        <Dialog
          onSubmit={onExitSubmit}
          onClose={() => setDialog(null)}
          title="Confirm exit"
          submitText="Exit"
        >
          <div>There are unsaved changes, are you sure you want to exit?</div>
        </Dialog>
      );
    } else if (d?.type == "game") {
      return <GameDialog pgn={d.pgn} onClose={() => setDialog(null)} />;
    }
    return null;
  });

  return (
    <>
      <Switch>
        <Match when={mode() == "set-initial-position"}>
          <SelectInitialPosition
            name={props.name}
            onSelect={(fen) => {
              editor.setInitialPosition(fen);
              setView(editor.view);
              setMode("");
            }}
            onExit={() => setMode("")}
          />
        </Match>
        <Match when={true}>
          <div class="flex flex-col h-screen">
            <div class="col-span-full header px-2 py-4 h-[76px]">
              <Header
                name={props.name}
                rootNode={props.rootNode}
                view={view()}
                editor={editor}
                setView={setView}
                saving={saving()}
                undo={undo}
                redo={redo}
                onSave={onSave}
                onExit={onExit}
              />
            </div>
            <div class="flex grow justify-center gap-4">
              <div class="pt-4 pl-2 flex flex-col gap-8 w-100">
                <Engine
                  currentPly={view().initialPly + view().ply}
                  position={view().position}
                  onMove={onMove}
                />
                <Book
                  position={view().position}
                  ply={view().ply}
                  onMove={onMove}
                  onShowGame={(pgn) => setDialog({ type: "game", pgn })}
                />
              </div>
              <div class="flex flex-col gap-8">
                <div class="flex">
                  <div class="flex" style={boardSize}>
                    <Board
                      chess={view().position}
                      lastMove={view().lastMove}
                      enableShapes={view().ply > 0}
                      shapes={view().currentNode.shapes}
                      onMove={onMove}
                      toggleShape={toggleShape}
                      onMoveBackwards={moveBackwards}
                      onMoveForwards={moveForwards}
                      onDeleteNode={deleteNode}
                      withArrows
                      withDeleteNode
                    />
                  </div>
                </div>
                <div class="grow">
                  <CurrentNodeControls
                    isRoot={view().ply == 0}
                    rootNode={props.rootNode}
                    view={view()}
                    editor={editor}
                    setView={setView}
                    setDraftComment={setDraftComment}
                    commitDraftComment={commitDraftComment}
                    toggleNag={toggleNag}
                    reorderMenuItems={reorderMenuItems}
                    onReorder={onReorder}
                    onSetInitialPosition={() => setMode("set-initial-position")}
                  />
                </div>
              </div>
              <div class="pt-2 basis-[320px] shrink-0">
                <MoveView
                  rootNode={props.rootNode}
                  moveView={moveView()}
                  setMoveView={setMoveView}
                  view={view()}
                  setMoves={setMoves}
                  reorderMenuItems={reorderMenuItems}
                  onReorder={onReorder}
                />
              </div>
            </div>
          </div>
        </Match>
      </Switch>
      {openDialog()}
    </>
  );
}

interface HeaderProps {
  name: string;
  rootNode: RootNode;
  view: EditorView;
  setView: (view: EditorView) => void;
  editor: EditorBackend;
  saving: boolean;
  undo: () => void;
  redo: () => void;
  onSave: () => void;
  onExit: () => void;
}

function Header(props: HeaderProps) {
  return (
    <div class="flex justify-between gap-10">
      <div class="w-100 truncate flex items-center">
        <GameInfo
          view={props.view}
          setView={props.setView}
          editor={props.editor}
        />
      </div>
      <div class="text-3xl truncate">
        <Switch>
          <Match when={props.rootNode.type == RootNodeType.Normal}>
            {props.name}
          </Match>
          <Match when={props.rootNode.type == RootNodeType.Training}>
            {props.name}
          </Match>
        </Switch>
      </div>
      <div class="w-100 flex justify-end gap-8">
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

interface MoveViewProps {
  rootNode: RootNode;
  view: EditorView;
  moveView: string;
  setMoveView: (view: string) => void;
  setMoves: (moves: readonly Move[]) => void;
  reorderMenuItems: ReorderMenuItems;
  onReorder: ReorderMoves;
}

function MoveView(props: MoveViewProps) {
  const moveViewText = createMemo(() => {
    if (props.moveView == "game") {
      return "Game view";
    } else {
      return "Line view";
    }
  });

  return (
    <div class="flex flex-col min-h-full min-w-full">
      <div class="flex items-center justify-between pb-2">
        <div class="text-lg text-fg-2">{moveViewText()}</div>
        <MenuButton
          icon={<Settings class="text-fg-2" />}
          style="flat"
          items={[
            {
              type: "item",
              value: "game",
              text: "Game view",
              selected: props.moveView == "game",
            },
            {
              type: "item",
              value: "line",
              text: "Line view",
              selected: props.moveView == "line",
            },
          ]}
          onSelect={props.setMoveView}
        />
      </div>
      <div class="pr-2 basis-0 grow overflow-auto">
        <Switch>
          <Match when={props.moveView == "game"}>
            <GameViewMoves
              rootNode={props.rootNode}
              view={props.view}
              setMoves={props.setMoves}
              reorderMenuItems={props.reorderMenuItems}
              onReorder={props.onReorder}
            />
          </Match>
          <Match when={props.moveView == "line"}>
            <LineViewMoves
              rootNode={props.rootNode}
              view={props.view}
              setMoves={props.setMoves}
              reorderMenuItems={props.reorderMenuItems}
              onReorder={props.onReorder}
            />
          </Match>
        </Switch>
      </div>
    </div>
  );
}
