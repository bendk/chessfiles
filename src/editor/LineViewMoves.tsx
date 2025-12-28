import type { JSXElement } from "solid-js";
import { createSignal } from "solid-js";
import type { Move } from "~/lib/chess";
import type { RootNode } from "~/lib/node";
import type { EditorTree, EditorView } from "~/lib/editor";
import type { ReorderMoves, ReorderMenuItems } from "./Editor";
import { Menu } from "~/components";
import type { MoveViewContext } from "./MoveViewShared";
import {
  MoveList,
  moveButton,
  renderMoves,
  secondaryBlock,
} from "./MoveViewShared";

function render(
  node: RootNode,
  line: EditorTree,
  context: MoveViewContext,
): JSXElement {
  const output: JSXElement = [];
  const moveList = MoveList.init(node);

  let atStartOfBranch = false;
  let lineIndex = 0;
  while (lineIndex < line.length) {
    const item = line[lineIndex];
    const moves = item.moves.slice(atStartOfBranch ? 1 : 0);
    const selectedBranch = item.branches.findIndex((b) => b.selected);
    if (selectedBranch >= 0) {
      moves.pop();
      moves.push(item.branches[selectedBranch].line[0].moves[0]);
      line = item.branches[selectedBranch].line;
      lineIndex = 0;
      atStartOfBranch = true;
    } else {
      atStartOfBranch = false;
      lineIndex++;
    }

    output.push(renderMoves(moves, moveList, context));

    if (item.comment) {
      output.push(
        secondaryBlock(<span class="text-fg-2">{item.comment} </span>, 1),
      );
    }

    if (item.branches.length > 0) {
      const parentMoveList = moveList.clone().pop();
      const branches = [
        moveButton(
          item.moves.at(-1)!,
          context,
          parentMoveList,
          false,
          selectedBranch == -1,
        ),
        ...item.branches.map((b, i) =>
          moveButton(
            b.line[0].moves[0],
            context,
            parentMoveList,
            false,
            selectedBranch == i,
          ),
        ),
      ];
      output.push(secondaryBlock(branches, 1));
    }
  }

  return output;
}

export interface LineViewMovesProps {
  rootNode: RootNode;
  view: EditorView;
  reorderMenuItems?: ReorderMenuItems;
  onReorder?: ReorderMoves;
  setMoves: (moves: readonly Move[]) => void;
}

export function LineViewMoves(props: LineViewMovesProps) {
  const [reorderMoves, setReorderMoves] = createSignal<readonly Move[]>([]);
  return (
    <Menu
      onSelect={(op) => {
        if (!props.onReorder) {
          return;
        }
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
          <div class="grid grid-cols-[40px_100px_1fr] w-[300px] text-xl py-1 px-2 bg-bg-1">
            {output}
          </div>
        );
      }}
    </Menu>
  );
}
