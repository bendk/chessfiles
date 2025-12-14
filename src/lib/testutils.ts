import type { Color } from "./chess";
import { Chess, parseSan, parseFen } from "./chess";
import { ChildNode, RootNode } from "./node";

/**
 * Quick way to build a node tree
 *
 * @param nodeSpec like a node, except moves are stored inside the `node` object directly rather
 *    than inside the `children` field.
 */
export function buildNode(nodeSpec: object): RootNode {
  let chess;
  if ("position" in nodeSpec) {
    chess = Chess.fromSetup(
      parseFen(nodeSpec.position as string).unwrap(),
    ).unwrap();
    delete nodeSpec["position"];
  } else {
    chess = Chess.default();
  }
  const initialMoves = [];

  if ("initialMoves" in nodeSpec) {
    for (const san of nodeSpec.initialMoves as string[]) {
      const move = parseSan(chess, san);
      chess.play(move);
      initialMoves.push(move);
    }
    delete nodeSpec["initialMoves"];
  }
  let color = undefined;
  if ("color" in nodeSpec) {
    color = nodeSpec["color"] as Color;
    delete nodeSpec["color"];
  }

  const children = Object.entries(nodeSpec).map(([key, value]) =>
    buildChildNode(chess.clone(), key, value),
  );
  const node = new RootNode(chess, children);
  if (initialMoves.length > 0) {
    node.initialMoves = initialMoves;
  }
  node.setColor(color);
  return node;
}

export function buildChildNode(
  position: Chess,
  san: string,
  nodeSpec: object,
): ChildNode {
  const move = parseSan(position, san);
  if (!(move && "from" in move)) {
    throw Error(`Invalid move: ${san}`);
  }
  position.play(move);
  const node = new ChildNode(move);
  const children = [];

  for (const [key, value] of Object.entries(nodeSpec)) {
    if (key === "comment") {
      node[key] = value;
    } else if (key === "nags") {
      node.nags = value;
    } else if (key === "shapes") {
      node.shapes = value;
    } else if (key === "priority") {
      node.priority = value;
    } else {
      children.push(buildChildNode(position.clone(), key, value));
    }
  }
  node.children = children;
  return node;
}
