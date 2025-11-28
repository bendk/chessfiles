import { test, expect } from "vitest";

import type { Chess, Move, PgnGame, Shape } from "./chess";
import {
  moveEquals,
  Nag,
  makeFen,
  makeSan,
  makeSanAndPlay,
  parseSan,
  parseSquare,
  pgnToString,
} from "./chess";
import { Priority, type RootNode } from "./node";
import { buildNode } from "./node.test";
import { Editor } from "./editor";

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

function makeSanArray(
  initialPosition: Chess,
  moves: readonly Move[],
): string[] {
  const pos = initialPosition.clone();
  return moves.map((move) => makeSanAndPlay(pos, move));
}

interface EditorNodeSpec {
  moves: string[];
  currentMove: number;
  comment?: string;
  shapes?: readonly Shape[];
  nags?: readonly Nag[];
  priority?: Priority;
}

interface EditorStateSpec {
  ply: number;
  line: EditorNodeSpec[];
}

function checkEditorState(editor: Editor, stateSpec: EditorStateSpec) {
  const initialPosition = editor.rootNode.initialPosition;
  const currentPosition = initialPosition.clone();

  const line: EditorNodeSpec[] = [];
  const movesToParent = [];

  // Map editor nodes to EditorNodeSpec items
  for (const editorNode of editor.view.line) {
    // The main work here is conventing moves to move spec strings
    const moves: string[] = editorNode.parentMoves.map((move) => {
      expect(move.san).toEqual(makeSan(currentPosition, move.move));
      let moveSpec = move.san;
      if (move.hasComment) {
        moveSpec += " *";
      }
      if (move.priority == Priority.TrainFirst) {
        moveSpec += " +";
      } else if (move.priority == Priority.TrainLast) {
        moveSpec += " -";
      }
      if (move.nagText.length > 0) {
        moveSpec += ` ${move.nagText}`;
      }
      return moveSpec;
    });
    line.push({
      moves,
      currentMove: editorNode.parentMoves.findIndex((m) =>
        moveEquals(m.move, editorNode.node.move),
      ),
      comment: editorNode.node.comment,
      shapes: editorNode.node.shapes,
      nags: editorNode.node.nags,
      priority: editorNode.node.priority,
    });

    // Check that the position and movesToParent fields
    expect(makeSanArray(initialPosition, editorNode.movesToParent)).toEqual(
      makeSanArray(initialPosition, movesToParent),
    );
    currentPosition.play(editorNode.node.move);
    movesToParent.push(editorNode.node.move);
    expect(makeFen(editorNode.position.toSetup())).toEqual(
      makeFen(currentPosition.toSetup()),
    );
  }

  // Compare everything
  expect(editor.view.ply).toEqual(stateSpec.ply);
  const expectedLine = stateSpec.line.map((editorNode) => ({
    comment: undefined,
    nags: undefined,
    shapes: undefined,
    priority: 0,
    ...editorNode,
  }));
  expect(line).toEqual(expectedLine);
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

test("moving with existing moves", () => {
  const editor = new Editor(testRootNode());
  checkEditorState(editor, {
    ply: 0,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
  });

  moveSan(editor, "e4");
  checkEditorState(editor, {
    ply: 1,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
  });

  moveSan(editor, "e5");
  checkEditorState(editor, {
    ply: 2,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
  });

  moveSan(editor, "Nf3");
  checkEditorState(editor, {
    ply: 3,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
  });

  editor.moveBackward();
  checkEditorState(editor, {
    ply: 2,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
  });

  editor.moveForward();
  checkEditorState(editor, {
    ply: 3,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
  });
});

test("moving with new moves", () => {
  const editor = new Editor(testRootNode());
  moveSan(editor, "e4");
  moveSan(editor, "e5");
  moveSan(editor, "f4");
  checkEditorState(editor, {
    ply: 3,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *", "f4"],
        currentMove: 1,
      },
    ],
  });

  moveSan(editor, "d5");
  checkEditorState(editor, {
    ply: 4,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *", "f4"],
        currentMove: 1,
      },
      {
        moves: ["d5"],
        currentMove: 0,
      },
    ],
  });

  editor.moveBackward();
  moveSan(editor, "exf4");
  checkEditorState(editor, {
    ply: 4,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *", "f4"],
        currentMove: 1,
      },
      {
        moves: ["d5", "exf4"],
        currentMove: 1,
      },
    ],
  });
});

test("delete node", () => {
  const editor = new Editor(testRootNode());
  moveSan(editor, "e4", "e5", "Nf3");
  editor.deleteNode();
  checkEditorState(editor, {
    ply: 2,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
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
    ply: 4,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6 *", "Nf6"],
        currentMove: 0,
        comment: "Hi",
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
  });

  // add comment to the root node
  editor.setMoves([]);
  editor.setComment("Hello from the root");
  checkEditorState(editor, {
    ply: 0,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6 *", "Nf6"],
        currentMove: 0,
        comment: "Hi",
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
  });
});

test("nags", () => {
  // add nag
  const editor = new Editor(testRootNode());
  moveSan(editor, "e4");
  editor.toggleNag(Nag.GoodMove);
  checkEditorState(editor, {
    ply: 1,
    line: [
      {
        moves: ["e4 !"],
        currentMove: 0,
        nags: [Nag.GoodMove],
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
  });

  // test mutually exclusive nags
  editor.toggleNag(Nag.DubiousMove);
  checkEditorState(editor, {
    ply: 1,
    line: [
      {
        moves: ["e4 ?!"],
        currentMove: 0,
        nags: [Nag.DubiousMove],
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
  });

  // Remove
  editor.toggleNag(Nag.DubiousMove);
  checkEditorState(editor, {
    ply: 1,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
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
    ply: 1,
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
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
  });

  editor.toggleShape({
    color: "green",
    from: parseSquare("e4"),
    to: parseSquare("e4"),
  });
  checkEditorState(editor, {
    ply: 1,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
  });
});

test("priority", () => {
  const editor = new Editor(testRootNode());
  moveSan(editor, "e4");
  editor.setPriority(Priority.TrainLast);
  checkEditorState(editor, {
    ply: 1,
    line: [
      {
        moves: ["e4 -"],
        currentMove: 0,
        priority: Priority.TrainLast,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
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
    ply: 2,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e6", "e5"],
        currentMove: 0,
      },
      {
        moves: ["d4", "Nf3"],
        currentMove: 0,
      },
      {
        moves: ["d5"],
        currentMove: 0,
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

test("undo moves", () => {
  const editor = new Editor(testRootNode());
  moveSan(editor, "d4");
  editor.undo();
  checkEditorState(editor, {
    ply: 0,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
  });

  moveSan(editor, "d4");
  moveSan(editor, "d5");
  editor.setMoves([]);
  editor.undo();
  checkEditorState(editor, {
    ply: 0,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
  });

  editor.redo();
  checkEditorState(editor, {
    ply: 2,
    line: [
      {
        moves: ["e4", "d4"],
        currentMove: 1,
      },
      {
        moves: ["d5"],
        currentMove: 0,
      },
    ],
  });

  editor.undo();
  checkEditorState(editor, {
    ply: 0,
    line: [
      {
        moves: ["e4"],
        currentMove: 0,
      },
      {
        moves: ["e5", "e6"],
        currentMove: 0,
      },
      {
        moves: ["Nf3 *"],
        currentMove: 0,
        comment: "Hello",
      },
      {
        moves: ["Nc6", "Nf6"],
        currentMove: 0,
      },
      {
        moves: ["Bc4"],
        currentMove: 0,
      },
    ],
  });
});

test("undo moves are not merged if the user moves in-between", () => {
  const editor = new Editor(testRootNode());
  moveSan(editor, "d4");
  editor.moveBackward();
  editor.moveForward();
  moveSan(editor, "d5");
  editor.undo(); // this should only undo `d5`, since the user moved after `d4`

  checkEditorState(editor, {
    ply: 1,
    line: [
      {
        moves: ["e4", "d4"],
        currentMove: 1,
      },
    ],
  });

  // setMoves also breaks the move chain
  moveSan(editor, "d5");
  setMovesSan(editor, []);
  setMovesSan(editor, ["d4", "d5"]);
  moveSan(editor, "c4");
  editor.undo();

  checkEditorState(editor, {
    ply: 2,
    line: [
      {
        moves: ["e4", "d4"],
        currentMove: 1,
      },
      {
        moves: ["d5"],
        currentMove: 0,
      },
    ],
  });

  // undo/redo also breaks the move chain
  moveSan(editor, "c4");
  editor.undo();
  editor.redo();
  moveSan(editor, "e6");
  editor.undo();

  checkEditorState(editor, {
    ply: 3,
    line: [
      {
        moves: ["e4", "d4"],
        currentMove: 1,
      },
      {
        moves: ["d5"],
        currentMove: 0,
      },
      {
        moves: ["c4"],
        currentMove: 0,
      },
    ],
  });
});

test("undo/redo", () => {
  const editor = new Editor(buildNode({}));

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
