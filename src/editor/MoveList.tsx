import Book from "lucide-solid/icons/book";
import type { JSXElement } from "solid-js";
import { createSignal } from "solid-js";
import { makeSanAndPlay, nagText } from "~/lib/chess";
import type { Chess, Move } from "~/lib/chess";
import { Priority } from "~/lib/node";
import type { Node as ChessNode, RootNode } from "~/lib/node";
import type { EditorView } from "~/lib/editor";
import type { ReorderMoves, ReorderMenuItems } from "./Editor";
import type { MenuContext } from "~/components";
import { contextMenuEventHandlers, Menu } from "~/components";

/**
 * Render a node into an array of JSX elements
 *
 * This is a bit hacky because a) it's written for performance and b) it needs some refactoring.
 */
function renderNode(
  node: RootNode,
  view: EditorView,
  setMoves: (moves: readonly Move[]) => void,
  menu: MenuContext,
  setReorderMoves: (move: readonly Move[]) => void,
  reorderMenuItems: ReorderMenuItems,
): JSXElement[] {
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
    menu,
    setReorderMoves,
    reorderMenuItems,
    // Note: placeholder value, this won't be used.
    moveLink: document.createElement("div"),
  };

  renderNodeInner(context, output);
  return output;
}

function renderNodeInner(context: RenderNodeContext, output: JSXElement[]) {
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
  moveLink: JSXElement;
  position: Chess;
  ply: number;
  renderNextMoveNum: boolean;
  whiteToMove: boolean;
  moves: Move[];
  setMoves: (moves: readonly Move[]) => void;
  menu: MenuContext;
  setReorderMoves: (move: readonly Move[]) => void;
  reorderMenuItems: ReorderMenuItems;
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

  const eventHandlers = contextMenuEventHandlers(context.menu, () => {
    context.setReorderMoves(moves);
    return context.reorderMenuItems(moves);
  });
  const moveLink = (
    <a
      href="#"
      classList={{
        "text-highlight-1": context.nodesInLine.has(childNode),
        "text-fg-2w": !context.nodesInLine.has(childNode),
        underline:
          context.nodesInLine.has(childNode) &&
          childNode === context.selectedNode,
      }}
      {...eventHandlers}
      onClick={() => context.setMoves(moves)}
    >
      {moveNum}
      {moveSan}
      {priorityString}
      {nagTextString}
      {commentString}
    </a>
  );

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
  reorderMenuItems: ReorderMenuItems;
  onReorder: ReorderMoves;
  setMoves: (moves: readonly Move[]) => void;
}

export function MoveList(props: MoveListProps) {
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
        <div class="text-lg/[25px]">
          <button
            class="cursor-pointer translate-y-1 mr-2"
            onClick={() => props.setMoves([])}
          >
            <Book size={20} />
          </button>
          {renderNode(
            props.rootNode,
            props.view,
            props.setMoves,
            menu,
            setReorderMoves,
            props.reorderMenuItems,
          )}
        </div>
      )}
    </Menu>
  );
}
