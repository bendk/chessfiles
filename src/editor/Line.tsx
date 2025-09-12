import ArrowUp from "lucide-solid/icons/arrow-up";
import ArrowDown from "lucide-solid/icons/arrow-down";
import Book from "lucide-solid/icons/book";
import SquareMore from "lucide-solid/icons/message-square-more";
import { For } from "solid-js";
import type { Move } from "~/lib/chess";
import { Priority } from "~/lib/node";
import type { EditorView, EditorNode } from "~/lib/editor";

interface NodeProps {
  node: EditorNode;
  setMoves: (moves: readonly Move[]) => void;
}

function Node(props: NodeProps) {
  return (
    <div
      class="flex flex-col"
      style={{
        "padding-top": `${props.node.padding * 22}px`,
      }}
    >
      {
        // It's simpler and probably more efficient to just render the move list directly rather
        // than messing around with Index or For
        props.node.moves.map((move, i) => {
          const textColor = () => {
            if (i != props.node.currentMove) {
              return "text-zinc-400";
            }
            if (props.node.selected) {
              return "text-sky-600 dark:text-sky-300";
            } else {
              return "text-zinc-700 dark:text-zinc-100";
            }
          };
          const isDraft = () =>
            i == props.node.currentMove && props.node.currentMoveIsDraft;
          return (
            <button
              class={`flex items-center gap-0.5 px-1 cursor-pointer ${textColor()}`}
              classList={{
                "dark:bg-zinc-800": isDraft(),
                "bg-zinc-200": isDraft(),
                italic: isDraft(),
              }}
              onClick={() =>
                props.setMoves([...props.node.movesToNode, move.move])
              }
            >
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

export interface LineProps {
  view: EditorView;
  setMoves: (moves: readonly Move[]) => void;
}

export function Line(props: LineProps) {
  return (
    <div>
      <div class="flex text-lg items-start pb-4">
        <button
          class="py-0.5 cursor-pointer"
          classList={{
            "text-sky-500": props.view.ply == 0,
          }}
          onClick={() => props.setMoves([])}
        >
          <Book size={20} />
        </button>
        <For each={props.view.line}>
          {(node) => <Node node={node} setMoves={props.setMoves} />}
        </For>
      </div>
    </div>
  );
}
