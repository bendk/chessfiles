import ArrowUp from "lucide-solid/icons/arrow-up";
import ArrowDown from "lucide-solid/icons/arrow-down";
import Book from "lucide-solid/icons/book";
import SquareMore from "lucide-solid/icons/message-square-more";
import { createSignal, Index } from "solid-js";
import { moveEquals } from "~/lib/chess";
import type { Move } from "~/lib/chess";
import { Priority } from "~/lib/node";
import type { EditorView, EditorNode } from "~/lib/editor";
import type { MenuContext } from "~/components";
import { MenuContextTrigger, Menu } from "~/components";
import type { ReorderMoves, ReorderMenuItems } from "./Editor";

interface NodeProps {
  index: number;
  ply: number;
  plyIsCurrent: boolean;
  editorNode: EditorNode;
  menu: MenuContext;
  reorderMenuItems: ReorderMenuItems;
  setReorderMoves: (move: readonly Move[]) => void;
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
              return "text-fg-2";
            }
            if (props.plyIsCurrent) {
              return "text-highlight-1 underline";
            } else {
              return "text-highlight-1";
            }
          };
          const allMoves = [...props.editorNode.movesToParent, move.move];
          return (
            <MenuContextTrigger
              menu={props.menu}
              generateMenu={() => {
                props.setReorderMoves(allMoves);
                return props.reorderMenuItems(allMoves);
              }}
            >
              <button
                class={`flex items-center gap-0.5 px-1 text-nowrap cursor-pointer ${textColor()}`}
                onClick={() => props.setMoves(allMoves)}
              >
                {moveNum}
                {move.san}
                {move.priority == Priority.TrainFirst ? (
                  <ArrowUp size={14} />
                ) : null}
                {move.priority == Priority.TrainLast ? (
                  <ArrowDown size={14} />
                ) : null}
                {move.nagText}{" "}
                {move.hasComment ? <SquareMore size={14} /> : null}
              </button>
            </MenuContextTrigger>
          );
        })
      }
    </div>
  );
}

export interface MoveTreeProps {
  view: EditorView;
  setMoves: (moves: readonly Move[]) => void;
  reorderMenuItems: ReorderMenuItems;
  onReorder: ReorderMoves;
}

export function MoveTree(props: MoveTreeProps) {
  const [reorderMoves, setReorderMoves] = createSignal<readonly Move[]>([]);

  return (
    <Menu
      onSelect={(op) => {
        const moves = reorderMoves();
        if (moves.length == 0) {
          console.error("MoveTree.onSelect: reorderMoves is empty");
          return;
        }
        setReorderMoves([]);
        props.onReorder(moves, op);
      }}
      placement="top"
    >
      {(menu) => (
        <div class="flex text-lg/[25px] items-start">
          <button
            class="cursor-pointer translate-y-1"
            onClick={() => props.setMoves([])}
          >
            <Book size={20} />
          </button>
          <Index each={props.view.line}>
            {(node, index) => (
              <Node
                menu={menu}
                index={index}
                ply={props.view.initialPly + index}
                plyIsCurrent={props.view.ply - 1 == index}
                editorNode={node()}
                setMoves={props.setMoves}
                setReorderMoves={setReorderMoves}
                reorderMenuItems={props.reorderMenuItems}
              />
            )}
          </Index>
        </div>
      )}
    </Menu>
  );
}
