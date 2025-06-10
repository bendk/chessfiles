import { test, expect } from "vitest";

import type { PgnGame, Shape } from "./chess";
import { Nag, parseSan, parseSquare, pgnToString } from "./chess";
import { Priority, type RootNode } from "./node";
import { buildNode } from "./node.test";
import type { EditorMove, EditorNode } from "./editor";
import { Editor } from "./editor";

function moveSan(editor: Editor, san: string) {
  editor.move(parseSan(editor.view.position, san));
}

function setMovesSan(editor: Editor, san: string[]) {
  const position = editor.rootNode.initialPosition.clone();
  const moves = san.map((san) => {
    const move = parseSan(position, san);
    position.play(move);
    return move;
  });

  editor.setMoves(moves);
}

interface EditorNodeSpec {
  moves: string[];
  currentMove: number;
  currentMoveIsDraft?: boolean;
  selected?: boolean;
  comment?: string;
  shapes?: Shape[];
  nags?: Nag[];
  priority?: Priority;
  padding: number;
}

interface EditorStateSpec {
  line: EditorNodeSpec[];
  currentNode?: {
    isDraft?: boolean;
    comment?: string;
    nags?: Nag[];
    shapes?: Shape[];
    priority?: Priority;
  };
}

function checkEditorState(editor: Editor, stateSpec: EditorStateSpec) {
  const currentPosition = editor.rootNode.initialPosition.clone();

  const line: EditorNode[] = [];
  const movesToNode = [];
  for (const node of stateSpec.line) {
    const moves: EditorMove[] = node.moves.map((move) => {
      let san,
        nagText = "",
        hasComment = false,
        priority = Priority.Default;
      for (const part of move.split(" ")) {
        if (part == "*") {
          hasComment = true;
        } else if (part == "+") {
          priority = Priority.TrainFirst;
        } else if (part == "-") {
          priority = Priority.TrainLast;
        } else if (part.match(/^[A-Za-z]/)) {
          san = part;
        } else {
          nagText = part;
        }
      }
      if (san === undefined) {
        throw Error(`Invalid move spec: ${move}`);
      }
      return {
        move: parseSan(currentPosition, san),
        san,
        nagText,
        hasComment,
        priority,
      };
    });
    const move = moves[node.currentMove];
    currentPosition.play(move.move);
    line.push({
      selected: false,
      currentMoveIsDraft: false,
      comment: undefined,
      shapes: undefined,
      nags: undefined,
      priority: Priority.Default,
      movesToNode: [...movesToNode],
      ...node,
      moves,
    });
    movesToNode.push(move.move);
  }
  expect(editor.view.line).toEqual(line);
  expect(editor.view.currentNode).toEqual({
    isDraft: false,
    comment: "",
    nags: [],
    shapes: [],
    priority: Priority.Default,
    ...(stateSpec.currentNode ?? {}),
  });
}

function testRootNode(): RootNode {
  return buildNode({
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

test("moves and views", () => {
  const editor = new Editor(testRootNode());
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
  });

  moveSan(editor, "e4");
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        selected: true,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
  });

  moveSan(editor, "e5");
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        selected: true,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
  });

  moveSan(editor, "Nf3");
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        selected: true,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
    currentNode: {
      comment: "Hello",
    },
  });

  editor.moveBackwards();
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        selected: true,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
  });

  editor.moveForwards();
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        selected: true,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
    currentNode: {
      comment: "Hello",
    },
  });

  editor.moveBackwards();
  moveSan(editor, "f4");
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *", "f4"],
        currentMove: 1,
        currentMoveIsDraft: true,
        selected: true,
        padding: 0,
      },
    ],
    currentNode: {
      isDraft: true,
    },
  });

  moveSan(editor, "d5");
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *", "f4"],
        currentMove: 1,
        currentMoveIsDraft: true,
        padding: 0,
      },
      {
        moves: ["d5"],
        currentMove: 0,
        currentMoveIsDraft: true,
        selected: true,
        padding: 1,
      },
    ],
    currentNode: {
      isDraft: true,
    },
  });

  setMovesSan(editor, ["e4", "e5"]);
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        selected: true,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
  });

  setMovesSan(editor, ["d4", "d5", "c4"]);
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4", "d4"],
        currentMove: 1,
        currentMoveIsDraft: true,
        selected: false,
        padding: 0,
      },
      {
        moves: ["d5"],
        currentMove: 0,
        currentMoveIsDraft: true,
        selected: false,
        padding: 1,
      },
      {
        moves: ["c4"],
        currentMove: 0,
        currentMoveIsDraft: true,
        selected: true,
        padding: 1,
      },
    ],
    currentNode: {
      isDraft: true,
    },
  });

  editor.moveBackwards();
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4", "d4"],
        currentMove: 1,
        currentMoveIsDraft: true,
        selected: false,
        padding: 0,
      },
      {
        moves: ["d5"],
        currentMove: 0,
        currentMoveIsDraft: true,
        selected: true,
        padding: 1,
      },
    ],
    currentNode: {
      isDraft: true,
    },
  });

  setMovesSan(editor, ["e4", "e5", "Nf3", "Nc6", "Bc4"]);
  editor.moveBackwards();
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
        selected: true,
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
  });

  setMovesSan(editor, ["e4", "e6", "Nf3"]);
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 1,
        padding: 0,
      },
      {
        moves: ["d4", "Nf3"],
        currentMove: 1,
        padding: 1,
        selected: true,
      },
      {
        moves: ["d5"],
        currentMove: 0,
        padding: 2,
      },
    ],
  });
});

test("add line", () => {
  const editor = new Editor(testRootNode());
  setMovesSan(editor, ["e4", "e5", "Nc3", "Nf6"]);
  editor.addLine();
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *", "Nc3"],
        currentMove: 1,
        padding: 0,
      },
      {
        moves: ["Nf6"],
        currentMove: 0,
        selected: true,
        padding: 1,
      },
    ],
  });

  // Test adding after moving backwards
  setMovesSan(editor, ["e4", "e5", "Bc4", "Nf6", "d4"]);
  editor.moveBackwards();
  editor.moveBackwards();

  editor.addLine();
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *", "Nc3", "Bc4"],
        currentMove: 2,
        selected: true,
        padding: 0,
      },
    ],
  });
});

test("delete line", () => {
  const editor = new Editor(testRootNode());
  setMovesSan(editor, ["e4", "e5", "Nf3"]);
  editor.deleteLine();
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        selected: true,
        padding: 0,
      },
    ],
  });
});

test("comments", () => {
  // add comment
  const editor = new Editor(testRootNode());
  setMovesSan(editor, ["e4", "e5", "Nf3", "Nc6"]);
  editor.setComment("Hi");
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6 *", "Nf6"],
        currentMove: 0,
        selected: true,
        comment: "Hi",
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
    currentNode: {
      comment: "Hi",
    },
  });

  // add comment to the root node
  setMovesSan(editor, []);
  editor.setComment("Hello from the root");
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6 *", "Nf6"],
        currentMove: 0,
        comment: "Hi",
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
    currentNode: {
      comment: "Hello from the root",
    },
  });
});

test("nags", () => {
  // add nag
  const editor = new Editor(testRootNode());
  setMovesSan(editor, ["e4"]);
  editor.toggleNag(Nag.GoodMove);
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4 !"],
        currentMove: 0,
        selected: true,
        nags: [Nag.GoodMove],
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
    currentNode: {
      nags: [Nag.GoodMove],
    },
  });

  // test mutually exclusive nags
  editor.toggleNag(Nag.DubiousMove);
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4 ?!"],
        currentMove: 0,
        nags: [Nag.DubiousMove],
        selected: true,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
    currentNode: {
      nags: [Nag.DubiousMove],
    },
  });

  // Remove
  editor.toggleNag(Nag.DubiousMove);
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        selected: true,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
  });
});

test("shapes", () => {
  const editor = new Editor(testRootNode());
  setMovesSan(editor, ["e4"]);
  editor.toggleShape({
    color: "green",
    from: parseSquare("e4"),
    to: parseSquare("e4"),
  });
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4 *"],
        currentMove: 0,
        shapes: [
          {
            color: "green",
            from: parseSquare("e4"),
            to: parseSquare("e4"),
          },
        ],
        selected: true,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
    currentNode: {
      shapes: [
        {
          color: "green",
          from: parseSquare("e4"),
          to: parseSquare("e4"),
        },
      ],
    },
  });

  editor.toggleShape({
    color: "green",
    from: parseSquare("e4"),
    to: parseSquare("e4"),
  });
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        selected: true,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
  });
});

test("priority", () => {
  const editor = new Editor(testRootNode());
  setMovesSan(editor, ["e4"]);
  editor.setPriority(Priority.TrainLast);
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4 -"],
        currentMove: 0,
        priority: Priority.TrainLast,
        selected: true,
        padding: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
        padding: 0,
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
        padding: 0,
      },
    ],
    currentNode: {
      priority: Priority.TrainLast,
    },
  });
});

test("reorder moves", () => {
  const editor = new Editor(testRootNode());
  setMovesSan(editor, ["e4", "e6"]);
  const position = editor.rootNode.initialPosition.clone();
  position.play(parseSan(position, "e4"));
  editor.reorderMoves([parseSan(position, "e6"), parseSan(position, "e5")]);
  checkEditorState(editor, {
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["e6", "e5"],
        currentMove: 0,
        selected: true,
        padding: 0,
      },
      {
        moves: ["d4", "Nf3"],
        currentMove: 0,
        padding: 0,
      },
      {
        moves: ["d5"],
        currentMove: 0,
        padding: 0,
      },
    ],
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

test("undo/redo", () => {
  const editor = new Editor(buildNode({}));

  expect(editor.view.canUndo).toBeFalsy();
  expect(editor.view.canRedo).toBeFalsy();

  // Add some lines, and remember the node tree after each
  const export0 = editor.rootNode.export();
  setMovesSan(editor, ["e4", "e5", "Nf3", "Nc6"]);
  editor.addLine();
  const export1 = editor.rootNode.export();
  setMovesSan(editor, ["e4", "e5", "Nf3", "Nf6"]);
  editor.addLine();
  const export2 = editor.rootNode.export();
  setMovesSan(editor, ["e4", "e6"]);
  editor.addLine();
  const export3 = editor.rootNode.export();
  // Delete a single line
  editor.deleteLine();
  const export4 = editor.rootNode.export();
  // Delete a tree of lines
  setMovesSan(editor, ["e4", "e5", "Nf3"]);
  editor.deleteLine();
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
  setMovesSan(editor, ["e4", "e6"]);
  checkRedo(export5, true, false);
  checkUndo(export4, true, true);
  setMovesSan(editor, ["e4", "e5"]);
  checkUndo(export3, true, true);
  checkUndo(export2, true, true);
  checkUndo(export1, true, true);
  checkUndo(export0, false, true);
  setMovesSan(editor, ["e4", "Nf6"]);
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
    buildNode({
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
  setMovesSan(editor, ["e4"]);
  editor.addLine();
  expect(editor.view.canUndo).toBeFalsy();

  editor.setComment("Hi");
  expect(editor.view.canUndo).toBeFalsy();

  setMovesSan(editor, ["e4", "e5"]);
  const position = editor.rootNode.initialPosition.clone();
  position.play(parseSan(position, "e4"));
  editor.reorderMoves([parseSan(position, "e5")]);
  expect(editor.view.canUndo).toBeFalsy();

  setMovesSan(editor, ["d4", "d5"]);
  editor.deleteLine();
  expect(editor.view.canUndo).toBeFalsy();

  editor.setTrainingColor("white");
  expect(editor.view.canUndo).toBeFalsy();
});
