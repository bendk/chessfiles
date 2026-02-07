import type { JSXElement } from "solid-js";
import { createEffect, createSignal } from "solid-js";
import type { Move } from "~/lib/chess";
import type { RootNode } from "~/lib/node";
import type { EditorBranch, EditorTree, EditorView } from "~/lib/editor";
import type { ReorderMoves, ReorderMenuItems } from "./Editor";
import { Menu } from "~/components";
import type { MoveViewContext } from "./MoveViewShared";
import { MoveList, renderMoves, secondaryBlock } from "./MoveViewShared";

function render(
  node: RootNode,
  line: EditorTree,
  context: MoveViewContext,
): JSXElement {
  const output: JSXElement = [];
  const moveList = MoveList.init(node);
  for (const item of line) {
    output.push(renderMoves(item.moves, moveList, context));

    if (item.comment) {
      output.push(
        secondaryBlock(<span class="text-fg-2">{item.comment} </span>, 1),
      );
    }

    if (item.branches.length > 0) {
      output.push(
        renderBranches(moveList.clone().pop(), item.branches, context, 1),
      );
    }
  }

  return output;
}

function renderBranches(
  moveList: MoveList,
  branches: EditorBranch[],
  context: MoveViewContext,
  depth: number,
): JSXElement {
  return branches.map((b) =>
    renderBranch(moveList.clone(), b.line, context, depth),
  );
}

function renderBranch(
  moveList: MoveList,
  line: EditorTree,
  context: MoveViewContext,
  depth: number,
): JSXElement {
  const output: JSXElement[] = [];
  let current: JSXElement[] = [];

  for (const item of line) {
    for (let i = 0; i < item.moves.length; i++) {
      current.push(
        moveList.pushAndMakeButton(
          item.moves[i],
          context,
          i == 0 || moveList.whiteToMove,
        ),
      );
    }
    if (item.comment) {
      current.push(<span class="text-fg-2">{item.comment} </span>);
    }
    if (item.branches.length > 0) {
      output.push(current);
      current = [];
      output.push(
        renderBranches(
          moveList.clone().pop(),
          item.branches,
          context,
          depth + 1,
        ),
      );
    }
  }
  if (current.length > 0) {
    output.push(current);
  }

  return secondaryBlock(output, depth);
}

export interface GameViewMovesProps {
  rootNode: RootNode;
  view: EditorView;
  reorderMenuItems?: ReorderMenuItems;
  onContextMenuAction?: ReorderMoves;
  setMoves: (moves: readonly Move[]) => void;
}

export function GameViewMoves(props: GameViewMovesProps) {
  const [reorderMoves, setReorderMoves] = createSignal<readonly Move[]>([]);
  let elt!: HTMLDivElement;
  // Ensure the current move is visible
  createEffect(() => {
    // access the current node so this re-runs when it changes
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    props.view.currentNode.node;
    const selectedElt = elt.getElementsByClassName("selected-node")[0];
    if (!selectedElt) {
      return;
    }
    const scroller = elt.closest(".overflow-auto");
    if (scroller) {
      const rect = selectedElt.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      if (rect.bottom + 40 > scrollerRect.bottom) {
        scroller.scrollTop += scrollerRect.height - 120;
      } else if (rect.top - 40 < scrollerRect.top) {
        scroller.scrollTop -= scrollerRect.height - 120;
      }
    }
  });
  return (
    <Menu
      onSelect={(op) => {
        if (!props.onContextMenuAction) {
          return;
        }
        const moves = reorderMoves();
        if (moves.length == 0) {
          console.error("MoveTree.onSelect: reorderMoves is empty");
          return;
        }
        setReorderMoves([]);
        props.onContextMenuAction(moves, op);
      }}
      placement="top"
    >
      {(menu) => {
        if (props.rootNode.isEmpty()) {
          return "";
        }

        const context = {
          selectedNode: props.view.selectedNode,
          setMoves: props.setMoves,
          menu,
          setReorderMoves,
          reorderMenuItems: props.reorderMenuItems,
        };
        const output = render(props.rootNode, props.view.tree, context);
        return (
          <div
            ref={elt}
            class="grid grid-cols-[40px_100px_1fr] w-[300px] text-xl py-1 px-2 bg-bg-1"
          >
            {output}
          </div>
        );
      }}
    </Menu>
  );
}
