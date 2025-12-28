import { createSignal, Show } from "solid-js";
import type { Move } from "~/lib/chess";
import type { RootNode } from "~/lib/node";
import { Editor } from "~/lib/editor";
import { Book } from "~/lib/node";
import { Board, Dialog, GameViewMoves } from "~/components";

export interface GameDialogProps {
  pgn: string;
  onClose: () => void;
}

export function GameDialog(props: GameDialogProps) {
  let rootNode: RootNode | null = null;
  let title;

  try {
    rootNode = Book.import(props.pgn).rootNodes[0];
    title = rootNode.displayName(1);
  } catch (e) {
    console.error("Error parsing book", e);
    title = "Error parsing game";
  }

  return (
    <Dialog title={title} onSubmit={props.onClose} submitText="Close">
      <Show when={rootNode} keyed>
        {(rootNode) => <GameDialogInner rootNode={rootNode} />}
      </Show>
    </Dialog>
  );
}

interface GameDialogInnerProps {
  rootNode: RootNode;
}

export function GameDialogInner(props: GameDialogInnerProps) {
  const editor = new Editor(props.rootNode);
  const [view, setView] = createSignal(editor.view);

  function moveForward() {
    if (editor.canMoveForwardGameView()) {
      editor.moveForwardGameView();
      setView(editor.view);
    }
  }

  function moveBackward() {
    if (editor.canMoveBackwardGameView()) {
      editor.moveBackwardGameView();
      setView(editor.view);
    }
  }

  function setMoves(moves: readonly Move[]) {
    editor.setMoves(moves);
    setView(editor.view);
  }

  return (
    <div class="flex justify-center">
      <div
        class="flex flex-col items-center"
        onClick={moveForward}
        onMouseUp={(evt) => {
          if (evt.button == 2) {
            moveBackward();
          }
        }}
      >
        <div class="w-150 h-170 cursor-pointer">
          <Board
            chess={view().position}
            shapes={view().currentNode.shapes}
            withArrows
            viewOnly
            onMoveForwards={moveForward}
            onMoveBackwards={moveBackward}
          />
        </div>
      </div>
      <div class="overflow-auto h-150">
        <GameViewMoves
          rootNode={props.rootNode}
          setMoves={setMoves}
          view={view()}
        />
      </div>
    </div>
  );
}
