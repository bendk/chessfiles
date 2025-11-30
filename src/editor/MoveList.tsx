import Book from "lucide-solid/icons/book";
import { createMemo } from "solid-js";
import { makeSanAndPlay, nagText } from "~/lib/chess";
import type { Chess, Move } from "~/lib/chess";
import { Priority } from "~/lib/node";
import type { Node as ChessNode, RootNode } from "~/lib/node";
import type { EditorView } from "~/lib/editor";

/**
 * Render a node into an array of HTML elements
 *
 * This isn't a Solid component because we're potentially rendering a ton of deeply nested nodes.
 * To keep things fast we avoid creating any tracking scopes.
 */
function renderNode(
  node: RootNode,
  view: EditorView,
  setMoves: (moves: readonly Move[]) => void,
): Node[] {
  const output: Node[] = [];
  const whiteToMove = node.initialPosition.turn == "white";
  const context: RenderNodeContext = {
    node,
    nodesInLine: new Set(view.line.map((editorNode) => editorNode.node)),
    selectedNode: view.currentNode.node,
    position: node.initialPosition.clone(),
    ply: whiteToMove ? 0 : 1,
    renderNextMoveNum: true,
    whiteToMove,
    moves: [],
    setMoves,
    // Note: this won't be used for
    moveLink: document.createElement("div"),
  };

  renderNodeInner(context, output);
  return output;
}

function renderNodeInner(context: RenderNodeContext, output: Node[]) {
  // Render first move link
  if (context.node.children.length == 0) {
    return;
  }
  const mainChildContext = childContext(context, 0);
  output.push(mainChildContext.moveLink);

  if (
    context.node.children.length > 1 ||
    mainChildContext.node.children.length > 0
  ) {
    output.push(document.createTextNode(" "));
  }

  // Render other children as alternatives
  for (let i = 1; i < context.node.children.length; i++) {
    const altChildContext = childContext(context, i);
    output.push(document.createTextNode("("));
    output.push(altChildContext.moveLink);
    if (altChildContext.node.children.length > 0) {
      output.push(document.createTextNode(" "));
      renderNodeInner(altChildContext, output);
    }
    output.push(document.createTextNode(") "));
  }

  // Render first move children after we've rendered the alternatives
  renderNodeInner(mainChildContext, output);
}

/// Data to handle a single node of `renderNode`
interface RenderNodeContext {
  node: ChessNode;
  nodesInLine: Set<ChessNode>;
  selectedNode: ChessNode | undefined;
  moveLink: Node;
  position: Chess;
  ply: number;
  renderNextMoveNum: boolean;
  whiteToMove: boolean;
  moves: Move[];
  setMoves: (moves: readonly Move[]) => void;
}

function childContext(
  context: RenderNodeContext,
  index: number,
): RenderNodeContext {
  const childNode = context.node.children[index];
  const position = context.position.clone();
  const ply = context.ply + 1;
  const moveNum = context.renderNextMoveNum
    ? `${1 + Math.floor(ply / 2)}${context.whiteToMove ? "." : "\u2026"}`
    : "";
  const moveSan = makeSanAndPlay(position, childNode.move);
  let priorityString = "";
  if (childNode.priority == Priority.TrainFirst) {
    priorityString = "\u2191";
  } else if (childNode.priority == Priority.TrainLast) {
    priorityString = "\u2193";
  }
  const nagTextString = childNode.nags
    ? childNode.nags.map(nagText).join("")
    : "";
  const commentString = childNode.comment
    ? ` [${childNode.comment.trim()}]`
    : "";

  const moves = [...context.moves, childNode.move];
  const whiteToMove = !context.whiteToMove;
  const willDisplayAfterAlternatives =
    index == 0 && context.node.children.length > 1;

  const moveLink = document.createElement("a");
  moveLink.text = `${moveNum}${moveSan}${priorityString}${nagTextString}${commentString}`;
  moveLink.href = "#";
  if (context.nodesInLine.has(childNode)) {
    moveLink.classList.add("text-highlight-1");
    if (childNode === context.selectedNode) {
      moveLink.classList.add("underline");
    }
  } else {
    moveLink.classList.add("text-fg-2");
  }
  moveLink.addEventListener("click", () => context.setMoves(moves));

  return {
    ...context,
    node: childNode,
    moveLink,
    position,
    ply: context.ply + 1,
    renderNextMoveNum: whiteToMove || willDisplayAfterAlternatives,
    whiteToMove,
    moves,
  };
}

export interface MoveListProps {
  rootNode: RootNode;
  view: EditorView;
  setMoves: (moves: readonly Move[]) => void;
}

export function MoveList(props: MoveListProps) {
  const renderedNodes = createMemo(() => {
    return renderNode(props.rootNode, props.view, props.setMoves);
  });

  return (
    <div>
      <div class="text-lg/[25px]">
        <button
          class="cursor-pointer translate-y-1 mr-2"
          onClick={() => props.setMoves([])}
        >
          <Book size={20} />
        </button>
        {renderedNodes()}
      </div>
    </div>
  );
}
