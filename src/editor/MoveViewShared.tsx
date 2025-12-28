import type { JSXElement } from "solid-js";
import { nagText } from "~/lib/chess";
import type { Move } from "~/lib/chess";
import type { Node as ChessNode, RootNode } from "~/lib/node";
import type { EditorMove } from "~/lib/editor";
import type { ReorderMenuItems } from "./Editor";
import type { MenuContext } from "~/components";
import { contextMenuEventHandlers } from "~/components";

// Context for rendering MoveList/MoveTree
export interface MoveViewContext {
  selectedNode: ChessNode;
  setMoves: (moves: readonly Move[]) => void;
  menu: MenuContext;
  setReorderMoves: (move: readonly Move[]) => void;
  reorderMenuItems: ReorderMenuItems | undefined;
}

export class MoveList {
  constructor(
    public moveNum: number,
    public whiteToMove: boolean,
    public moves: Move[],
  ) {}

  static init(rootNode: RootNode): MoveList {
    const position = rootNode.initialPosition.clone();
    return new MoveList(1, position.turn == "white", []);
  }

  clone(): MoveList {
    return new MoveList(this.moveNum, this.whiteToMove, [...this.moves]);
  }

  push(move: EditorMove) {
    if (this.whiteToMove) {
      this.whiteToMove = false;
    } else {
      this.whiteToMove = true;
      this.moveNum++;
    }
    this.moves.push(move.node.move);
  }

  pushAndMakeButton(
    move: EditorMove,
    context: MoveViewContext,
    showNumber: boolean,
  ): JSXElement {
    const button = moveButton(
      move,
      context,
      this,
      showNumber,
      move.node === context.selectedNode,
    );
    this.push(move);
    return button;
  }

  pop(): MoveList {
    if (this.whiteToMove) {
      this.whiteToMove = false;
      this.moveNum--;
    } else {
      this.whiteToMove = true;
    }
    this.moves.pop();
    return this;
  }
}

export function renderMoves(
  moves: readonly EditorMove[],
  moveList: MoveList,
  context: MoveViewContext,
): JSXElement {
  const output = [];
  let i = 0;
  while (i < moves.length) {
    const moveNum = moveList.moveNum;
    if (!moveList.whiteToMove) {
      // Black move only
      const move = moveList.pushAndMakeButton(moves[i++], context, false);
      output.push(
        <div class="pb-1 col-span-2">{moveNum}&hellip;</div>,
        <div>{move}</div>,
      );
    } else if (i + 1 >= moves.length) {
      // White move only
      const move = moveList.pushAndMakeButton(moves[i++], context, false);
      output.push(
        <div class="pb-1">{moveNum}.</div>,
        <div class="col-span-2">{move}</div>,
      );
    } else {
      // move for both sides
      const white = moveList.pushAndMakeButton(moves[i++], context, false);
      const black = moveList.pushAndMakeButton(moves[i++], context, false);
      output.push(
        <div class="pb-1">{moveNum}.</div>,
        <div>{white}</div>,
        <div>{black}</div>,
      );
    }
  }
  return output;
}

export function moveButton(
  move: EditorMove,
  context: MoveViewContext,
  moveList: MoveList,
  showNumber: boolean,
  selected: boolean,
): JSXElement {
  const currentMoves = [...moveList.moves, move.node.move];
  let eventHandlers = undefined;
  let text = move.san + move.nags.map(nagText).join(" ");

  if (showNumber) {
    if (moveList.whiteToMove) {
      text = `${moveList.moveNum}. ${text}`;
    } else {
      text = `${moveList.moveNum}\u2026 ${text}`;
    }
  }

  const reorderMenuItems = context.reorderMenuItems;
  if (reorderMenuItems !== undefined) {
    eventHandlers = contextMenuEventHandlers(context.menu, () => {
      context.setReorderMoves(currentMoves);
      return reorderMenuItems(currentMoves);
    });
  }

  const moveButton = (
    <button
      {...eventHandlers}
      class="cursor-pointer px-1 mr-1"
      classList={{
        "rounded-md bg-selection": selected,
        "hover-fg": !selected,
      }}
      onClick={() => context.setMoves(currentMoves)}
    >
      {text}
    </button>
  );
  return moveButton;
}

export function secondaryBlock(
  elements: JSXElement,
  depth: number,
): JSXElement {
  return (
    <div
      class="col-start-1 col-span-full text-base pr-1 bg-bg-2 -mx-2"
      style={`padding-left: ${16 + depth * 8}px`}
    >
      {elements}
    </div>
  );
}
