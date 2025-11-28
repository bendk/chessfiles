import ArrowUp from "lucide-solid/icons/arrow-up";
import ArrowDown from "lucide-solid/icons/arrow-down";
import Book from "lucide-solid/icons/book";
import SquareMore from "lucide-solid/icons/message-square-more";
import { Index } from "solid-js";
import { moveEquals } from "~/lib/chess";
import type { Move } from "~/lib/chess";
import { Priority } from "~/lib/node";
import type { EditorView, EditorNode } from "~/lib/editor";

interface NodeProps {
  index: number;
  ply: number;
  plyIsCurrent: boolean;
  editorNode: EditorNode;
  setMoves: (moves: readonly Move[]) => void;
}

function Node(props: NodeProps) {
  let moveNum = "";
  const whiteToMove = props.ply % 2 == 0;
  if (props.index == 0 || whiteToMove) {
    moveNum += `${1 + Math.floor(props.ply / 2)}${whiteToMove ? "." : "\u2026"}`;
  }
  return (
    <div class="flex flex-col">
      {
        // It's simpler and probably more efficient to just render the move list directly rather
        // than messing around with Index or For
        props.editorNode.parentMoves.map((move) => {
          const textColor = () => {
            if (!moveEquals(move.move, props.editorNode.node.move)) {
              return "text-zinc-400";
            }
            if (props.plyIsCurrent) {
              return "text-sky-600 dark:text-sky-300 underline";
            } else {
              return "text-sky-600 dark:text-sky-300";
            }
          };
          return (
            <button
              class={`flex items-center gap-0.5 px-1 text-nowrap cursor-pointer ${textColor()}`}
              onClick={() =>
                props.setMoves([...props.editorNode.movesToParent, move.move])
              }
            >
              {moveNum}
              {move.san}
              {move.priority == Priority.TrainFirst ? (
                <ArrowUp size={14} />
              ) : null}
              {move.priority == Priority.TrainLast ? (
                <ArrowDown size={14} />
              ) : null}
              {move.nagText} {move.hasComment ? <SquareMore size={14} /> : null}
            </button>
          );
        })
      }
    </div>
  );
}

export interface MoveTreeProps {
  view: EditorView;
  setMoves: (moves: readonly Move[]) => void;
}

export function MoveTree(props: MoveTreeProps) {
  return (
    <div>
      <div class="flex text-lg/[25px] items-start">
        <button
          class="cursor-pointer translate-y-1"
          classList={{
            "text-sky-500": props.view.ply == 0,
          }}
          onClick={() => props.setMoves([])}
        >
          <Book size={20} />
        </button>
        <Index each={props.view.line}>
          {(node, index) => (
            <Node
              index={index}
              ply={props.view.initialPly + index}
              plyIsCurrent={props.view.ply - 1 == index}
              editorNode={node()}
              setMoves={props.setMoves}
            />
          )}
        </Index>
      </div>
    </div>
  );
}
