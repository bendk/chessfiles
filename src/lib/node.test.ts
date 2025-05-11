import { Chess } from "chessops/chess";
import { parseSan } from "chessops/san";
import { describe, test, expect } from "vitest";
import { type Move, Nag } from "./chess";
import { ChildNode, RootNode } from "./node";

/**
 * Quick way to build a node tree
 *
 * @param nodeSpec like a node, except moves are stored inside the `node` object directly rather
 *    than inside the `children` field.
 */
export function buildNode(nodeSpec: object): RootNode {
  const position = Chess.default();
  const children = Object.entries(nodeSpec).map(([key, value]) =>
    buildChildNode(position.clone(), key, value),
  );
  return new RootNode(position, children);
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
    } else {
      children.push(buildChildNode(position.clone(), key, value));
    }
  }
  node.children = children;
  return node;
}

export function moveList(root: RootNode, moves: string[]): Move[] {
  const position = root.position.clone();
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
    ).toEqual(0);
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
    expect(RootNode.import(node.export())).toEqual(node);
  });
});
