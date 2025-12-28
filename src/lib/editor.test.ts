import { test, expect } from "vitest";

import type { PgnGame, Shape } from "./chess";
import {
  Nag,
  makeFen,
  makeSanAndPlay,
  nagText,
  parseSan,
  parseSquare,
  pgnToString,
} from "./chess";
import { RootNodeType } from "./node";
import type { RootNode, Node } from "./node";
import { buildNode } from "./testutils";
import { Editor } from "./editor";
import type { EditorTree } from "./editor";

function moveSan(editor: Editor, ...sanStrings: string[]) {
  for (const san of sanStrings) {
    editor.move(parseSan(editor.view.position, san));
  }
}

function setMovesSan(editor: Editor, sanStrings: string[]) {
  const position = editor.rootNode.initialPosition.clone();
  const moves = sanStrings.map((san) => {
    const move = parseSan(position, san);
    position.play(move);
    return move;
  });

  editor.setMoves(moves);
}

interface EditorViewSpec {
  currentMoves: string;
  line: string;
  shapes?: Shape[];
}

function checkEditorState(editor: Editor, spec: EditorViewSpec) {
  const view = editor.view;

  // Check current moves
  let pos = editor.rootNode.initialPosition.clone();
  const currentMoves = view.currentNode.movesToNode.map((move) =>
    makeSanAndPlay(pos, move),
  );
  expect(currentMoves.join(" ")).toEqual(spec.currentMoves);
  expect(view.ply).toEqual(view.currentNode.movesToNode.length);

  // Check position/selectedNode
  pos = editor.rootNode.initialPosition.clone();
  let selectedNode: Node = editor.rootNode;
  for (const san of spec.currentMoves.split(" ")) {
    if (san == "") {
      continue;
    }
    const move = parseSan(pos, san);
    const child = selectedNode.getChild(move);
    if (child === undefined) {
      throw Error(`Can't find node for move: ${san}`);
    }
    selectedNode = child;
    pos.play(move);
  }
  expect(view.selectedNode).toBe(selectedNode);
  expect(makeFen(view.position.toSetup())).toEqual(makeFen(pos.toSetup()));

  expect(computeEditorTreeSpec(view.tree)).toEqual(spec.line);

  expect(view.shapes).toEqual(spec.shapes ?? []);
}

function computeEditorTreeSpec(line: EditorTree): string {
  const parts = [];
  for (const item of line) {
    parts.push(
      ...item.moves.map((m) => {
        let text = m.san;
        for (const nag of m.nags) {
          text += nagText(nag);
        }
        if (m.hasShape) {
          text += "[hasShape]";
        }
        return text;
      }),
    );
    if (item.comment.length > 0) {
      parts.push(item.comment);
    }
    if (item.branches.length > 0) {
      for (const branch of item.branches) {
        const spec = computeEditorTreeSpec(branch.line);
        if (branch.selected) {
          parts.push(`(*${spec})`);
        } else {
          parts.push(`(${spec})`);
        }
      }
    }
  }
  return parts.join(" ");
}

function testRootNode(): RootNode {
  return buildNode(RootNodeType.Normal, {
    e4: {
      e5: {
        Nf3: {
          comment: "Hello",
          Nc6: {
            Bc4: {},
          },
          Nf6: {},
        },
      },
      e6: {
        d4: {
          d5: {},
        },
        Nf3: {
          d5: {},
        },
      },
    },
  });
}

test("moving with existing moves", () => {
  const editor = new Editor(testRootNode());
  checkEditorState(editor, {
    currentMoves: "",
    line: "e4 e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  moveSan(editor, "e4");
  checkEditorState(editor, {
    currentMoves: "e4",
    line: "e4 e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  moveSan(editor, "e5");
  checkEditorState(editor, {
    currentMoves: "e4 e5",
    line: "e4 e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  moveSan(editor, "Nf3");
  checkEditorState(editor, {
    currentMoves: "e4 e5 Nf3",
    line: "e4 e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  editor.moveBackward();
  checkEditorState(editor, {
    currentMoves: "e4 e5",
    line: "e4 e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  editor.moveForward();
  checkEditorState(editor, {
    currentMoves: "e4 e5 Nf3",
    line: "e4 e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  setMovesSan(editor, ["e4", "e6"]);
  checkEditorState(editor, {
    currentMoves: "e4 e6",
    line: "e4 e5 (*e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  moveSan(editor, "Nf3");
  checkEditorState(editor, {
    currentMoves: "e4 e6 Nf3",
    line: "e4 e5 (*e6 d4 (*Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  moveSan(editor, "d5");
  checkEditorState(editor, {
    currentMoves: "e4 e6 Nf3 d5",
    line: "e4 e5 (*e6 d4 (*Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  editor.moveBackward();
  checkEditorState(editor, {
    currentMoves: "e4 e6 Nf3",
    line: "e4 e5 (*e6 d4 (*Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  editor.moveBackward();
  checkEditorState(editor, {
    currentMoves: "e4 e6",
    line: "e4 e5 (*e6 d4 (*Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });
});

test("moving with new moves", () => {
  const editor = new Editor(testRootNode());
  moveSan(editor, "e4");
  moveSan(editor, "e5");
  moveSan(editor, "f4");
  checkEditorState(editor, {
    currentMoves: "e4 e5 f4",
    line: "e4 e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello (*f4) Nc6 (Nf6) Bc4",
  });

  moveSan(editor, "d5");
  checkEditorState(editor, {
    currentMoves: "e4 e5 f4 d5",
    line: "e4 e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello (*f4 d5) Nc6 (Nf6) Bc4",
  });

  editor.moveBackward();
  moveSan(editor, "exf4");
  checkEditorState(editor, {
    currentMoves: "e4 e5 f4 exf4",
    line: "e4 e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello (*f4 d5 (*exf4)) Nc6 (Nf6) Bc4",
  });
});

test("delete node", () => {
  const editor = new Editor(testRootNode());
  moveSan(editor, "e4", "e5", "Nf3");
  editor.deleteNode();
  checkEditorState(editor, {
    currentMoves: "e4 e5",
    line: "e4 e5 (e6 d4 (Nf3 d5) d5)",
  });
});

test("comments", () => {
  // add comment
  const editor = new Editor(testRootNode());
  setMovesSan(editor, ["e4", "e5", "Nf3", "Nc6"]);
  editor.setComment("Hi");
  checkEditorState(editor, {
    currentMoves: "e4 e5 Nf3 Nc6",
    line: "e4 e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 Hi (Nf6) Bc4",
  });

  // add comment to the root node
  editor.setMoves([]);
  editor.setComment("Hello from the root");
  checkEditorState(editor, {
    currentMoves: "",
    line: "Hello from the root e4 e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 Hi (Nf6) Bc4",
  });
});

test("nags", () => {
  // add nag
  const editor = new Editor(testRootNode());
  moveSan(editor, "e4");
  editor.toggleNag(Nag.GoodMove);
  checkEditorState(editor, {
    currentMoves: "e4",
    line: "e4! e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  // test mutually exclusive nags
  editor.toggleNag(Nag.DubiousMove);
  checkEditorState(editor, {
    currentMoves: "e4",
    line: "e4?! e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });
  // Remove
  editor.toggleNag(Nag.DubiousMove);
  checkEditorState(editor, {
    currentMoves: "e4",
    line: "e4 e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });
});

test("shapes", () => {
  const editor = new Editor(testRootNode());
  moveSan(editor, "e4");
  editor.toggleShape({
    color: "green",
    from: parseSquare("e4"),
    to: parseSquare("e4"),
  });
  checkEditorState(editor, {
    currentMoves: "e4",
    line: "e4[hasShape] e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
    shapes: [
      {
        color: "green",
        from: parseSquare("e4"),
        to: parseSquare("e4"),
      },
    ],
  });

  editor.toggleShape({
    color: "red",
    from: parseSquare("a8"),
    to: parseSquare("b8"),
  });
  checkEditorState(editor, {
    currentMoves: "e4",
    line: "e4[hasShape] e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
    shapes: [
      {
        color: "green",
        from: parseSquare("e4"),
        to: parseSquare("e4"),
      },
      {
        color: "red",
        from: parseSquare("a8"),
        to: parseSquare("b8"),
      },
    ],
  });

  editor.toggleShape({
    color: "green",
    from: parseSquare("e4"),
    to: parseSquare("e4"),
  });
  checkEditorState(editor, {
    currentMoves: "e4",
    line: "e4[hasShape] e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
    shapes: [
      {
        color: "red",
        from: parseSquare("a8"),
        to: parseSquare("b8"),
      },
    ],
  });
});

test("reorder moves", () => {
  const editor = new Editor(testRootNode());
  setMovesSan(editor, ["e4", "e6"]);
  const position = editor.rootNode.initialPosition.clone();
  position.play(parseSan(position, "e4"));
  editor.reorderMoves([parseSan(position, "e6"), parseSan(position, "e5")]);
  checkEditorState(editor, {
    currentMoves: "e4 e6",
    line: "e4 e6 (e5 Nf3 Hello Nc6 (Nf6) Bc4) d4 (Nf3 d5) d5",
  });
});

test("setTrainingColor", () => {
  const editor = new Editor(testRootNode());
  expect(editor.view.color).toBe(undefined);
  editor.setTrainingColor("white");
  expect(editor.view.color).toEqual("white");
  editor.undo();
  expect(editor.view.color).toBe(undefined);
  editor.redo();
  expect(editor.view.color).toEqual("white");
});

test("undo moves", () => {
  const editor = new Editor(testRootNode());
  moveSan(editor, "d4");
  editor.undo();
  checkEditorState(editor, {
    currentMoves: "",
    line: "e4 e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  moveSan(editor, "d4");
  moveSan(editor, "d5");
  editor.setMoves([]);
  editor.undo();
  checkEditorState(editor, {
    currentMoves: "",
    line: "e4 e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  editor.redo();
  checkEditorState(editor, {
    currentMoves: "d4 d5",
    line: "e4 (*d4 d5) e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  editor.undo();
  checkEditorState(editor, {
    currentMoves: "",
    line: "e4 e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });
});

test("undo moves are not merged if the user moves in-between", () => {
  const editor = new Editor(testRootNode());
  moveSan(editor, "d4");
  editor.moveBackward();
  checkEditorState(editor, {
    currentMoves: "",
    line: "e4 (d4) e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });
  editor.moveForward();
  checkEditorState(editor, {
    currentMoves: "d4",
    line: "e4 (*d4) e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });
  moveSan(editor, "d5");
  checkEditorState(editor, {
    currentMoves: "d4 d5",
    line: "e4 (*d4 d5) e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });
  editor.undo(); // this should only undo `d5`, since the user moved after `d4`
  checkEditorState(editor, {
    currentMoves: "d4",
    line: "e4 (*d4) e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  // setMoves also breaks the move chain
  moveSan(editor, "d5");
  setMovesSan(editor, []);
  setMovesSan(editor, ["d4", "d5"]);
  moveSan(editor, "c4");
  editor.undo();
  checkEditorState(editor, {
    currentMoves: "d4 d5",
    line: "e4 (*d4 d5) e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });

  // undo/redo also breaks the move chain
  moveSan(editor, "c4");
  checkEditorState(editor, {
    currentMoves: "d4 d5 c4",
    line: "e4 (*d4 d5 c4) e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });
  editor.undo();
  checkEditorState(editor, {
    currentMoves: "d4 d5",
    line: "e4 (*d4 d5) e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });
  editor.redo();
  checkEditorState(editor, {
    currentMoves: "d4 d5 c4",
    line: "e4 (*d4 d5 c4) e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });
  moveSan(editor, "e6");
  editor.undo();
  checkEditorState(editor, {
    currentMoves: "d4 d5 c4",
    line: "e4 (*d4 d5 c4) e5 (e6 d4 (Nf3 d5) d5) Nf3 Hello Nc6 (Nf6) Bc4",
  });
});

test("undo/redo", () => {
  const editor = new Editor(buildNode(RootNodeType.Normal, {}));

  expect(editor.view.canUndo).toBeFalsy();
  expect(editor.view.canRedo).toBeFalsy();

  // Add some lines, and remember the node tree after each
  const export0 = editor.rootNode.export();
  moveSan(editor, "e4", "e5", "Nf3", "Nc6");
  const export1 = editor.rootNode.export();
  editor.moveBackward();
  moveSan(editor, "Nf6");
  const export2 = editor.rootNode.export();
  setMovesSan(editor, ["e4"]);
  moveSan(editor, "e6");
  const export3 = editor.rootNode.export();
  // Delete a single line
  editor.deleteNode();
  const export4 = editor.rootNode.export();
  // Delete a tree of lines
  setMovesSan(editor, ["e4", "e5", "Nf3"]);
  editor.deleteNode();
  const export5 = editor.rootNode.export();

  expect(editor.view.canUndo).toBeTruthy();
  expect(editor.view.canRedo).toBeFalsy();

  function checkUndo(
    pgnGame: PgnGame,
    expectedCanUndo: boolean,
    expectedCanRedo: boolean,
  ) {
    editor.undo();
    expect(pgnToString(editor.rootNode.export())).toEqual(pgnToString(pgnGame));
    expect(editor.view.canUndo).toEqual(expectedCanUndo);
    expect(editor.view.canRedo).toEqual(expectedCanRedo);
  }

  function checkRedo(
    pgnGame: PgnGame,
    expectedCanUndo: boolean,
    expectedCanRedo: boolean,
  ) {
    editor.redo();
    expect(pgnToString(editor.rootNode.export())).toEqual(pgnToString(pgnGame));
    expect(editor.view.canUndo).toEqual(expectedCanUndo);
    expect(editor.view.canRedo).toEqual(expectedCanRedo);
  }

  // Test clicking undo/redo in various combinations
  // In-between, we'll sometimes change the moves, which shouldn't affect anything
  checkUndo(export4, true, true);
  checkUndo(export3, true, true);
  checkRedo(export4, true, true);
  setMovesSan(editor, ["e4"]);
  checkRedo(export5, true, false);
  checkUndo(export4, true, true);
  setMovesSan(editor, []);
  checkUndo(export3, true, true);
  checkUndo(export2, true, true);
  checkUndo(export1, true, true);
  checkUndo(export0, false, true);
  setMovesSan(editor, ["e4"]);
  checkRedo(export1, true, true);
  checkRedo(export2, true, true);
  setMovesSan(editor, ["e4", "e6"]);
  checkRedo(export3, true, true);
  setMovesSan(editor, ["e4", "e5"]);
  checkRedo(export4, true, true);
  checkRedo(export5, true, false);
});

test("noop actions", () => {
  const editor = new Editor(
    buildNode(RootNodeType.Normal, {
      color: "white",
      e4: {
        comment: "Hi",
        nags: [Nag.BlunderMove],
        shapes: [
          {
            color: "green",
            from: parseSquare("e4"),
            to: parseSquare("e4"),
          },
        ],
        e5: {},
      },
      d4: {},
    }),
  );
  moveSan(editor, "e4");
  expect(editor.view.canUndo).toBeFalsy();

  editor.setComment("Hi");
  expect(editor.view.canUndo).toBeFalsy();

  setMovesSan(editor, ["e4", "e5"]);
  const position = editor.rootNode.initialPosition.clone();
  position.play(parseSan(position, "e4"));
  editor.reorderMoves([parseSan(position, "e5")]);
  expect(editor.view.canUndo).toBeFalsy();

  editor.setTrainingColor("white");
  expect(editor.view.canUndo).toBeFalsy();
});

test("game view forward/backward", () => {
  const rootNode = buildNode(RootNodeType.Normal, {
    e4: {
      e5: {
        Nf3: {
          Nc6: {},
          Nf6: {
            Nxe5: {},
          },
        },
      },
      e6: {
        d4: {
          d5: {},
        },
        Nf3: {
          d5: {},
        },
      },
    },
    d4: {
      d5: {
        c4: {},
        Nf3: {},
      },
      Nf6: {
        c4: {
          g6: {},
        },
      },
      e6: {},
    },
    c4: {},
  });
  const editor = new Editor(rootNode);
  const expectedMoves = [
    "",
    "e4",
    "d4",
    "d4 d5",
    "d4 Nf6",
    "d4 Nf6 c4",
    "d4 Nf6 c4 g6",
    "d4 e6",
    "d4 d5 c4",
    "d4 d5 Nf3",
    "c4",
    "e4 e5",
    "e4 e6",
    "e4 e6 d4",
    "e4 e6 Nf3",
    "e4 e6 Nf3 d5",
    "e4 e6 d4 d5",
    "e4 e5 Nf3",
    "e4 e5 Nf3 Nc6",
    "e4 e5 Nf3 Nf6",
    "e4 e5 Nf3 Nf6 Nxe5",
  ];

  function checkState(which: string, i: number) {
    const pos = editor.rootNode.initialPosition.clone();
    const san = editor.view.currentNode.movesToNode
      .map((m) => makeSanAndPlay(pos, m))
      .join(" ");
    expect(san, `check state ${which}-${i}`).toEqual(expectedMoves[i]);

    if (i == 0) {
      expect(
        editor.canMoveBackwardGameView(),
        `check state ${san}`,
      ).toBeFalsy();
      expect(
        editor.canMoveForwardGameView(),
        `check state ${san}`,
      ).toBeTruthy();
    } else if (i + 1 == expectedMoves.length) {
      expect(
        editor.canMoveBackwardGameView(),
        `check state ${san}`,
      ).toBeTruthy();
      expect(editor.canMoveForwardGameView(), `check state ${san}`).toBeFalsy();
    } else {
      expect(
        editor.canMoveBackwardGameView(),
        `check state ${san}`,
      ).toBeTruthy();
      expect(
        editor.canMoveForwardGameView(),
        `check state ${san}`,
      ).toBeTruthy();
    }
  }

  for (let i = 0; i < expectedMoves.length; i++) {
    checkState("forward", i);
    editor.moveForwardGameView();
  }

  for (let i = expectedMoves.length - 1; i >= 0; i--) {
    checkState("backward", i);
    editor.moveBackwardGameView();
  }
});
