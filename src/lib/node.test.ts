import { describe, test, expect } from "vitest";
import { type Move, parseSan, Nag } from "./chess";
import { RootNode, Book, RootNodeType } from "./node";
import { buildNode } from "./testutils";

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
    const node = buildNode(RootNodeType.Normal, {
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
    const node = buildNode(RootNodeType.Normal, {
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
    const node = buildNode(RootNodeType.Normal, {
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

describe("Book", function () {
  test("import/export training history", () => {
    const rootNode = buildNode(RootNodeType.Normal, { e4: { e5: {} } });
    const book = new Book([rootNode]);
    book.trainingHistory.added = 1000;
    book.trainingHistory.lastTrained = 2000;
    book.trainingHistory.trainingCount = 10;

    const book2 = Book.import(book.export());
    expect(book2.trainingHistory.added).toEqual(1000);
    expect(book2.trainingHistory.lastTrained).toEqual(2000);
    expect(book2.trainingHistory.trainingCount).toEqual(10);
  });
});
