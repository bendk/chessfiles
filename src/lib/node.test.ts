import { describe, test, expect } from "vitest";
import type { Color } from "./chess";
import { type Move, Chess, parseSan, parseFen, Nag } from "./chess";
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

export function moveList(root: RootNode, moves: string[]): Move[] {
  const position = root.initialPosition.clone();
  return moves.map((san) => {
    const move = parseSan(position, san);
    if (!(move && "from" in move)) {
      throw Error(`Invalid move: ${san}`);
    }
    position.play(move);
    return move;
  });
}

describe("Node", function () {
  test("getDescendant", () => {
    const node = buildNode({
      e4: {
        e5: {
          Nf3: {
            Nc6: {
              Bc4: {},
            },
            Nf6: {},
          },
        },
        e6: {},
      },
    });
    expect(node.getDescendant([])).toEqual(undefined);
    expect(node.getDescendant(moveList(node, ["e4"]))).toEqual(
      node.children[0],
    );
    expect(node.getDescendant(moveList(node, ["e4", "e6"]))).toEqual(
      node.children[0].children[1],
    );
  });

  test("line counts", () => {
    const node = buildNode({
      e4: {
        e5: {
          Nf3: {
            Nc6: {
              Bc4: {},
            },
            Nf6: {},
          },
        },
        e6: {},
      },
    });
    expect(node.lineCount()).toEqual(3);
    expect(node.getDescendant(moveList(node, ["e4"]))!.lineCount()).toEqual(3);
    expect(
      node.getDescendant(moveList(node, ["e4", "e5", "Nf3"]))!.lineCount(),
    ).toEqual(2);
    expect(
      node
        .getDescendant(moveList(node, ["e4", "e5", "Nf3", "Nc6"]))!
        .lineCount(),
    ).toEqual(1);
    expect(
      node.getDescendant(moveList(node, ["e4", "e6"]))!.lineCount(),
    ).toEqual(1);
  });
});

describe("Node import/export", function () {
  test("import/export", () => {
    const node = buildNode({
      e4: {
        e5: {
          comment: "Comment",
          Nf3: {
            nags: [Nag.GoodMove, Nag.EqualPosition],
            Nc6: {
              shapes: [
                {
                  from: 0,
                  to: 0,
                  color: "blue",
                },
                {
                  from: 8,
                  to: 16,
                  color: "red",
                },
              ],
            },
            Nf6: {},
          },
          Nc3: {},
        },
      },
    });
    node.headers.set("White", "Chess Files");
    node.headers.set(
      "FEN",
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
    const importedNode = RootNode.import(node.export());
    // workaround the fact that `id` changes each import by design
    importedNode.id = node.id;
    expect(importedNode).toEqual(node);
  });
});
