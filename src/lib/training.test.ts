import { describe, test, expect } from "vitest";
import type {
  CurrentLineEntry,
  TrainingBoardFeedback,
  TrainingSettings,
  TrainingState,
} from "./training";
import { Training } from "./training";
import type { Move, Shape } from "./chess";
import { makeFen, parseSan, playSan, Chess } from "./chess";
import { Book } from "./node";
import type { RootNode } from "./node";
import { Priority } from "./node";
import { buildNode } from "./node.test";

function openingRootNode(): RootNode {
  return buildNode({
    color: "black",
    e4: {
      shapes: [
        {
          from: 0,
          to: 0,
          color: "blue",
        },
      ],
      e5: {
        Nf3: {
          Nc6: {
            comment: "test comment",
            shapes: [
              {
                from: 0,
                to: 8,
                color: "green",
              },
            ],
          },
        },
      },
    },
  });
}

// Toy endgame where the kings start on a1 and a8
function endgameRootNode(): RootNode {
  return buildNode({
    position: "k7/8/8/8/8/8/8/K7 w - - 0 1",
    color: "black",
    Kb1: {
      Kb8: {},
    },
    Kb2: {
      Kb7: {},
    },
  });
}

// Another endgame where the kings start on h1 and h8
function endgameRootNode2(): RootNode {
  return buildNode({
    position: "7k/8/8/8/8/8/8/7K b - - 0 1",
    color: "white",
    Kg8: {
      Kg1: {},
    },
  });
}

// root node used to test priority order
function frenchDefenseRootNode() {
  return buildNode({
    position: "rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq - 1 3",
    dxe4: {
      Nxe4: {},
    },
    Nf6: {
      e5: {
        Nfd7: {
          priority: Priority.TrainFirst,
          f4: {
            priority: Priority.TrainFirst,
          },
        },
        Ne4: {
          priority: Priority.TrainLast,
          Nxe4: {
            priority: Priority.TrainLast,
          },
        },
      },
    },
    Bb4: {
      priority: Priority.TrainFirst,
      e5: {
        priority: Priority.TrainFirst,
      },
    },
  });
}

function createTraining(
  rootNodes: RootNode[],
  settings = testSettings,
): Training {
  return Training.create(settings, "/test book.pgn", new Book(rootNodes));
}

const testSettings: TrainingSettings = {
  skipAfter: Number.MAX_SAFE_INTEGER,
  shuffle: false,
};

interface CheckTrainingSpec {
  state: TrainingState;
  position: Chess;
  correct: number;
  incorrect: number;
  activityCorrect?: number;
  activityIncorrect?: number;
  linesTrained?: number;
  feedback?: TrainingBoardFeedback;
  comment?: string;
  shapes?: Shape[];
}

function checkTraining(training: Training, spec: CheckTrainingSpec) {
  expect(training.state).toEqual(spec.state);
  expect(training.meta.correctCount).toEqual(spec.correct);
  expect(training.meta.incorrectCount).toEqual(spec.incorrect);
  expect(training.meta.linesTrained).toEqual(spec.linesTrained ?? 0);
  expect(training.activity.correctCount).toEqual(
    spec.activityCorrect ?? spec.correct,
  );
  expect(training.activity.incorrectCount).toEqual(
    spec.activityIncorrect ?? spec.incorrect,
  );
  expect(makeFen(training.board.position.toSetup())).toEqual(
    makeFen(spec.position.toSetup()),
  );
  expect(training.board.comment).toEqual(spec.comment ?? "");
  expect(training.board.shapes).toEqual(spec.shapes ?? []);
  expect(training.board.feedback).toEqual(spec.feedback ?? null);
}

interface CurrentLineEntrySpec {
  move: string;
  score: "correct" | "incorrect" | null;
  incorrectTries?: string[];
}

function buildLine(
  position: Chess,
  ...spec: CurrentLineEntrySpec[]
): CurrentLineEntry[] {
  position = position.clone();
  return spec.map((item) => {
    const move = parseSan(position, item.move);
    const incorrectTriesSan = item.incorrectTries ?? [];
    const incorrectTries = incorrectTriesSan.map((san) =>
      parseSan(position, san),
    );
    position.play(move);
    return { move, score: item.score, incorrectTries };
  });
}

function tryMoveSan(training: Training, position: Chess, san: string): Move {
  const move = parseSan(position, san);
  training.tryMove(move);
  return move;
}

function tryMoveSanAndPlay(
  training: Training,
  position: Chess,
  san: string,
): Move {
  const move = tryMoveSan(training, position, san);
  position.play(move);
  return move;
}

describe("Training", () => {
  test("moving through a single position", () => {
    const training = createTraining([openingRootNode()]);

    const position = Chess.default();
    checkTraining(training, {
      state: { type: "advance-after-delay" },
      position,
      correct: 0,
      incorrect: 0,
      linesTrained: 0,
    });

    training.advance();
    playSan(position, "e4");
    checkTraining(training, {
      state: { type: "choose-move", wrongMoves: [] },
      position,
      correct: 0,
      incorrect: 0,
      linesTrained: 0,
      shapes: [
        {
          from: 0,
          to: 0,
          color: "blue",
        },
      ],
    });

    tryMoveSanAndPlay(training, position, "e5");
    checkTraining(training, {
      state: { type: "advance-after-delay" },
      position,
      correct: 1,
      incorrect: 0,
      linesTrained: 0,
    });

    training.advance();
    playSan(position, "Nf3");
    checkTraining(training, {
      state: { type: "choose-move", wrongMoves: [] },
      position,
      correct: 1,
      incorrect: 0,
      linesTrained: 0,
    });

    tryMoveSanAndPlay(training, position, "Nc6");
    checkTraining(training, {
      position,
      state: {
        type: "show-line-summary",
        initialPosition: Chess.default(),
        line: buildLine(
          Chess.default(),
          {
            move: "e4",
            score: null,
          },
          {
            move: "e5",
            score: "correct",
          },
          {
            move: "Nf3",
            score: null,
          },
          {
            move: "Nc6",
            score: "correct",
          },
        ),
      },
      correct: 2,
      incorrect: 0,
      linesTrained: 1,
      comment: "test comment",
      shapes: [
        {
          from: 0,
          to: 8,
          color: "green",
        },
      ],
    });

    training.finishLine();
    checkTraining(training, {
      state: { type: "show-training-summary" },
      position: Chess.default(),
      correct: 2,
      incorrect: 0,
      linesTrained: 1,
    });
  });

  test("moving through a multiple positions", () => {
    const training = createTraining([endgameRootNode(), endgameRootNode2()]);
    let position = endgameRootNode().initialPosition;
    checkTraining(training, {
      state: { type: "advance-after-delay" },
      position,
      correct: 0,
      incorrect: 0,
      linesTrained: 0,
    });

    training.advance();
    playSan(position, "Kb1");
    checkTraining(training, {
      state: { type: "choose-move", wrongMoves: [] },
      position,
      correct: 0,
      incorrect: 0,
      linesTrained: 0,
    });

    tryMoveSanAndPlay(training, position, "Kb8");
    checkTraining(training, {
      state: {
        type: "show-line-summary",
        initialPosition: endgameRootNode().initialPosition,
        line: buildLine(
          endgameRootNode().initialPosition,
          {
            move: "Kb1",
            score: null,
          },
          {
            move: "Kb8",
            score: "correct",
          },
        ),
      },
      position,
      correct: 1,
      incorrect: 0,
      linesTrained: 1,
    });

    training.finishLine();
    position = endgameRootNode().initialPosition;
    checkTraining(training, {
      state: { type: "advance-after-delay" },
      position,
      correct: 1,
      incorrect: 0,
      linesTrained: 1,
    });

    training.advance();
    playSan(position, "Kb2");
    checkTraining(training, {
      state: { type: "choose-move", wrongMoves: [] },
      position,
      correct: 1,
      incorrect: 0,
      linesTrained: 1,
    });

    tryMoveSanAndPlay(training, position, "Kb7");
    checkTraining(training, {
      state: {
        type: "show-line-summary",
        initialPosition: endgameRootNode().initialPosition,
        line: buildLine(
          endgameRootNode().initialPosition,
          {
            move: "Kb2",
            score: null,
          },
          {
            move: "Kb7",
            score: "correct",
          },
        ),
      },
      position,
      correct: 2,
      incorrect: 0,
      linesTrained: 2,
    });

    training.finishLine();
    position = endgameRootNode2().initialPosition;
    checkTraining(training, {
      state: { type: "advance-after-delay" },
      position,
      correct: 2,
      incorrect: 0,
      linesTrained: 2,
    });

    training.advance();
    playSan(position, "Kg8");
    checkTraining(training, {
      state: { type: "choose-move", wrongMoves: [] },
      position,
      correct: 2,
      incorrect: 0,
      linesTrained: 2,
    });

    tryMoveSanAndPlay(training, position, "Kg1");
    checkTraining(training, {
      state: {
        type: "show-line-summary",
        initialPosition: endgameRootNode2().initialPosition,
        line: buildLine(
          endgameRootNode2().initialPosition,
          {
            move: "Kg8",
            score: null,
          },
          {
            move: "Kg1",
            score: "correct",
          },
        ),
      },
      position,
      correct: 3,
      incorrect: 0,
      linesTrained: 3,
    });

    training.finishLine();
    checkTraining(training, {
      state: {
        type: "show-training-summary",
      },
      position: Chess.default(),
      correct: 3,
      incorrect: 0,
      linesTrained: 3,
    });
  });

  test("resuming a session", () => {
    // Start a training session and play some moves
    let training = createTraining([openingRootNode()]);
    let position = Chess.default();
    training.advance();
    playSan(position, "e4");
    tryMoveSanAndPlay(training, position, "e5");
    training.advance();
    playSan(position, "Nf3");
    checkTraining(training, {
      state: { type: "choose-move", wrongMoves: [] },
      position,
      correct: 1,
      incorrect: 0,
      linesTrained: 0,
    });

    // Restart the session, the session should move back to the start of the line and play the
    // moves forward
    const data = training.export();
    training = Training.import(data, testSettings);
    position = Chess.default();
    checkTraining(training, {
      state: { type: "advance-after-delay" },
      position,
      correct: 1,
      incorrect: 0,
      linesTrained: 0,
      activityCorrect: 0,
      activityIncorrect: 0,
    });

    training.advance();
    playSan(position, "e4");
    checkTraining(training, {
      state: { type: "advance-after-delay" },
      position,
      shapes: [
        {
          from: 0,
          to: 0,
          color: "blue",
        },
      ],
      correct: 1,
      incorrect: 0,
      linesTrained: 0,
      activityCorrect: 0,
      activityIncorrect: 0,
    });

    training.advance();
    playSan(position, "e5");
    checkTraining(training, {
      state: { type: "advance-after-delay" },
      position,
      correct: 1,
      incorrect: 0,
      linesTrained: 0,
      activityCorrect: 0,
      activityIncorrect: 0,
    });

    training.advance();
    playSan(position, "Nf3");
    checkTraining(training, {
      state: { type: "choose-move", wrongMoves: [] },
      position,
      correct: 1,
      incorrect: 0,
      linesTrained: 0,
      activityCorrect: 0,
      activityIncorrect: 0,
    });

    tryMoveSanAndPlay(training, position, "Nc6");
    checkTraining(training, {
      state: {
        type: "show-line-summary",
        initialPosition: Chess.default(),
        line: buildLine(
          Chess.default(),
          {
            move: "e4",
            score: null,
          },
          {
            move: "e5",
            score: "correct",
          },
          {
            move: "Nf3",
            score: null,
          },
          {
            move: "Nc6",
            score: "correct",
          },
        ),
      },
      position,
      comment: "test comment",
      shapes: [
        {
          from: 0,
          to: 8,
          color: "green",
        },
      ],
      correct: 2,
      incorrect: 0,
      linesTrained: 1,
      activityCorrect: 1,
      activityIncorrect: 0,
    });
  });

  test("wrong moves", () => {
    const training = createTraining([openingRootNode()]);
    const position = Chess.default();
    training.advance();
    playSan(position, "e4");
    let wrongMove = tryMoveSan(training, position, "d5");
    checkTraining(training, {
      state: {
        type: "choose-move",
        wrongMoves: ["d5"],
      },
      position,
      correct: 0,
      incorrect: 1,
      linesTrained: 0,
      shapes: [
        {
          from: 0,
          to: 0,
          color: "blue",
        },
      ],
      feedback: {
        type: "incorrect",
        move: wrongMove,
      },
    });
    const wrongMove2 = tryMoveSan(training, position, "d6");
    checkTraining(training, {
      state: {
        type: "choose-move",
        wrongMoves: ["d5", "d6"],
      },
      position,
      // A second wrong move shouldn't change the count
      correct: 0,
      incorrect: 1,
      linesTrained: 0,
      shapes: [
        {
          from: 0,
          to: 0,
          color: "blue",
        },
      ],
      feedback: {
        type: "incorrect",
        move: wrongMove2,
      },
    });
    tryMoveSan(training, position, "d5");
    checkTraining(training, {
      state: {
        type: "choose-move",
        wrongMoves: [
          // Choosing the same wrong move again, shouldn't add a new element to the list
          "d5",
          "d6",
        ],
      },
      position,
      correct: 0,
      incorrect: 1,
      linesTrained: 0,
      shapes: [
        {
          from: 0,
          to: 0,
          color: "blue",
        },
      ],
      feedback: {
        type: "incorrect",
        move: wrongMove,
      },
    });

    // Guessing the correct move should move to the show-correct-move step, without changing
    // the counts
    let correctMove = tryMoveSanAndPlay(training, position, "e5");
    checkTraining(training, {
      state: {
        type: "show-correct-move",
        score: "incorrect",
        correctMove: "e5",
        wrongMoves: ["d5", "d6"],
      },
      position,
      correct: 0,
      incorrect: 1,
      linesTrained: 0,
      feedback: {
        type: "correct",
        move: correctMove,
      },
    });

    training.advance();
    playSan(position, "Nf3");
    checkTraining(training, {
      state: { type: "choose-move", wrongMoves: [] },
      position,
      correct: 0,
      incorrect: 1,
      linesTrained: 0,
    });

    // We're at the very last move.  If the user guesses incorrect, then we should
    // show the correct move screen, then continue to show-line-summary.
    wrongMove = tryMoveSan(training, position, "Nf6");
    checkTraining(training, {
      state: {
        type: "choose-move",
        wrongMoves: ["Nf6"],
      },
      position,
      correct: 0,
      incorrect: 2,
      linesTrained: 0,
      feedback: {
        type: "incorrect",
        move: wrongMove,
      },
    });
    correctMove = tryMoveSanAndPlay(training, position, "Nc6");
    checkTraining(training, {
      state: {
        type: "show-correct-move",
        score: "incorrect",
        correctMove: "Nc6",
        wrongMoves: ["Nf6"],
      },
      position,
      correct: 0,
      incorrect: 2,
      linesTrained: 0,
      comment: "test comment",
      shapes: [
        {
          from: 0,
          to: 8,
          color: "green",
        },
      ],
      feedback: {
        type: "correct",
        move: correctMove,
      },
    });

    training.advance();
    checkTraining(training, {
      state: {
        type: "show-line-summary",
        initialPosition: Chess.default(),
        line: buildLine(
          Chess.default(),
          {
            move: "e4",
            score: null,
          },
          {
            move: "e5",
            score: "incorrect",
            incorrectTries: ["d5", "d6"],
          },
          {
            move: "Nf3",
            score: null,
          },
          {
            move: "Nc6",
            score: "incorrect",
            incorrectTries: ["Nf6"],
          },
        ),
      },
      position,
      correct: 0,
      incorrect: 2,
      linesTrained: 1,
      comment: "test comment",
      shapes: [
        {
          from: 0,
          to: 8,
          color: "green",
        },
      ],
    });
  });

  test("playing both sides", () => {
    const rootNode = openingRootNode();
    // If color is `undefined` then the user needs to choose moves for both sides
    rootNode.color = undefined;
    const training = createTraining([rootNode]);

    const position = rootNode.initialPosition.clone();
    checkTraining(training, {
      state: { type: "choose-move", wrongMoves: [] },
      position,
      correct: 0,
      incorrect: 0,
      linesTrained: 0,
    });

    tryMoveSanAndPlay(training, position, "e4");
    checkTraining(training, {
      state: { type: "choose-move", wrongMoves: [] },
      position,
      correct: 1,
      incorrect: 0,
      linesTrained: 0,
      shapes: [
        {
          from: 0,
          to: 0,
          color: "blue",
        },
      ],
    });

    tryMoveSanAndPlay(training, position, "e5");
    checkTraining(training, {
      state: { type: "choose-move", wrongMoves: [] },
      position,
      correct: 2,
      incorrect: 0,
      linesTrained: 0,
    });

    // Test wrong moves
    let wrongMove = tryMoveSan(training, position, "Nc3");
    checkTraining(training, {
      state: {
        type: "choose-move",
        wrongMoves: ["Nc3"],
      },
      position,
      correct: 2,
      incorrect: 1,
      linesTrained: 0,
      feedback: {
        type: "incorrect",
        move: wrongMove,
      },
    });

    let correctMove = tryMoveSanAndPlay(training, position, "Nf3");
    checkTraining(training, {
      state: {
        type: "show-correct-move",
        score: "incorrect",
        correctMove: "Nf3",
        wrongMoves: ["Nc3"],
      },
      position,
      correct: 2,
      incorrect: 1,
      linesTrained: 0,
      feedback: {
        type: "correct",
        move: correctMove,
      },
    });

    training.advance();
    checkTraining(training, {
      state: { type: "choose-move", wrongMoves: [] },
      position,
      correct: 2,
      incorrect: 1,
      linesTrained: 0,
    });

    wrongMove = tryMoveSan(training, position, "Nf6");
    checkTraining(training, {
      state: {
        type: "choose-move",
        wrongMoves: ["Nf6"],
      },
      position,
      correct: 2,
      incorrect: 2,
      linesTrained: 0,
      feedback: {
        type: "incorrect",
        move: wrongMove,
      },
    });

    correctMove = tryMoveSanAndPlay(training, position, "Nc6");
    checkTraining(training, {
      state: {
        type: "show-correct-move",
        score: "incorrect",
        correctMove: "Nc6",
        wrongMoves: ["Nf6"],
      },
      position,
      correct: 2,
      incorrect: 2,
      linesTrained: 0,
      comment: "test comment",
      shapes: [
        {
          from: 0,
          to: 8,
          color: "green",
        },
      ],
      feedback: {
        type: "correct",
        move: correctMove,
      },
    });

    training.advance();
    checkTraining(training, {
      state: {
        type: "show-line-summary",
        initialPosition: rootNode.initialPosition,
        line: buildLine(
          rootNode.initialPosition,
          {
            move: "e4",
            score: "correct",
          },
          {
            move: "e5",
            score: "correct",
          },
          {
            move: "Nf3",
            score: "incorrect",
            incorrectTries: ["Nc3"],
          },
          {
            move: "Nc6",
            score: "incorrect",
            incorrectTries: ["Nf6"],
          },
        ),
      },
      position,
      correct: 2,
      incorrect: 2,
      linesTrained: 1,
      comment: "test comment",
      shapes: [
        {
          from: 0,
          to: 8,
          color: "green",
        },
      ],
    });
  });

  test("wrong move adjustments", () => {
    const training = createTraining([openingRootNode()]);
    const position = Chess.default();
    training.advance();
    playSan(position, "e4");
    let wrongMove = tryMoveSan(training, position, "d5");
    checkTraining(training, {
      state: {
        type: "choose-move",
        wrongMoves: ["d5"],
      },
      position,
      correct: 0,
      incorrect: 1,
      linesTrained: 0,
      shapes: [
        {
          from: 0,
          to: 0,
          color: "blue",
        },
      ],
      feedback: {
        type: "incorrect",
        move: wrongMove,
      },
    });
    let correctMove = tryMoveSanAndPlay(training, position, "e5");
    checkTraining(training, {
      state: {
        type: "show-correct-move",
        score: "incorrect",
        correctMove: "e5",
        wrongMoves: ["d5"],
      },
      position,
      correct: 0,
      incorrect: 1,
      linesTrained: 0,
      feedback: {
        type: "correct",
        move: correctMove,
      },
    });

    training.updateLastScore("correct");
    checkTraining(training, {
      state: {
        type: "show-correct-move",
        score: "correct",
        correctMove: "e5",
        wrongMoves: ["d5"],
      },
      position,
      correct: 1,
      incorrect: 0,
      linesTrained: 0,
      feedback: {
        type: "correct",
        move: correctMove,
      },
    });

    training.advance();
    playSan(position, "Nf3");
    checkTraining(training, {
      state: { type: "choose-move", wrongMoves: [] },
      position,
      correct: 1,
      incorrect: 0,
      linesTrained: 0,
    });

    wrongMove = tryMoveSan(training, position, "Nf6");
    checkTraining(training, {
      state: {
        type: "choose-move",
        wrongMoves: ["Nf6"],
      },
      position,
      correct: 1,
      incorrect: 1,
      linesTrained: 0,
      feedback: {
        type: "incorrect",
        move: wrongMove,
      },
    });

    correctMove = tryMoveSanAndPlay(training, position, "Nc6");
    checkTraining(training, {
      state: {
        type: "show-correct-move",
        score: "incorrect",
        correctMove: "Nc6",
        wrongMoves: ["Nf6"],
      },
      position,
      correct: 1,
      incorrect: 1,
      linesTrained: 0,
      comment: "test comment",
      shapes: [
        {
          from: 0,
          to: 8,
          color: "green",
        },
      ],
      feedback: {
        type: "correct",
        move: correctMove,
      },
    });

    training.updateLastScore(null);
    checkTraining(training, {
      state: {
        type: "show-correct-move",
        score: null,
        correctMove: "Nc6",
        wrongMoves: ["Nf6"],
      },
      position,
      correct: 1,
      incorrect: 0,
      linesTrained: 0,
      comment: "test comment",
      shapes: [
        {
          from: 0,
          to: 8,
          color: "green",
        },
      ],
      feedback: {
        type: "correct",
        move: correctMove,
      },
    });

    training.advance();
    checkTraining(training, {
      state: {
        type: "show-line-summary",
        initialPosition: Chess.default(),
        line: buildLine(
          Chess.default(),
          {
            move: "e4",
            score: null,
          },
          {
            move: "e5",
            score: "correct",
            incorrectTries: ["d5"],
          },
          {
            move: "Nf3",
            score: null,
          },
          {
            move: "Nc6",
            score: null,
            incorrectTries: ["Nf6"],
          },
        ),
      },
      position,
      correct: 1,
      incorrect: 0,
      linesTrained: 1,
      comment: "test comment",
      shapes: [
        {
          from: 0,
          to: 8,
          color: "green",
        },
      ],
    });
  });

  test("skipping moves", () => {
    const training = createTraining([openingRootNode()]);
    const position = Chess.default();
    training.advance();
    playSan(position, "e4");

    // Test advance from the `choose-move` state.
    let move = parseSan(position, "e5");
    position.play(move);
    training.advance();
    checkTraining(training, {
      state: {
        type: "show-correct-move",
        score: "incorrect",
        correctMove: "e5",
        wrongMoves: [],
      },
      position,
      correct: 0,
      incorrect: 1,
      linesTrained: 0,
      feedback: {
        type: "correct",
        move,
      },
    });
    // Let's try that again
    training.advance();
    playSan(position, "Nf3");
    checkTraining(training, {
      state: { type: "choose-move", wrongMoves: [] },
      position,
      correct: 0,
      incorrect: 1,
      linesTrained: 0,
    });
    training.advance();
    move = parseSan(position, "Nc6");
    position.play(move);
    checkTraining(training, {
      state: {
        type: "show-correct-move",
        score: "incorrect",
        correctMove: "Nc6",
        wrongMoves: [],
      },
      position,
      correct: 0,
      incorrect: 2,
      linesTrained: 0,
      comment: "test comment",
      shapes: [
        {
          from: 0,
          to: 8,
          color: "green",
        },
      ],
      feedback: {
        type: "correct",
        move,
      },
    });

    training.advance();
    checkTraining(training, {
      state: {
        type: "show-line-summary",
        initialPosition: Chess.default(),
        line: buildLine(
          Chess.default(),
          {
            move: "e4",
            score: null,
          },
          {
            move: "e5",
            score: "incorrect",
          },
          {
            move: "Nf3",
            score: null,
          },
          {
            move: "Nc6",
            score: "incorrect",
          },
        ),
      },
      position,
      correct: 0,
      incorrect: 2,
      linesTrained: 1,
      comment: "test comment",
      shapes: [
        {
          from: 0,
          to: 8,
          color: "green",
        },
      ],
    });
  });

  test("trainingSession ordering by priority", () => {
    const training = createTraining([frenchDefenseRootNode()]);
    // Train the high-priority lines first.  (For the unit tests,
    // high-priority lines will be ordered by the order of their keys.
    // In a real session, they will be randomly ordered).
    //
    // Play the entire line, then check it at the end
    let position = frenchDefenseRootNode().initialPosition;
    tryMoveSanAndPlay(training, position, "Nf6");
    tryMoveSanAndPlay(training, position, "e5");
    tryMoveSanAndPlay(training, position, "Nfd7");
    tryMoveSanAndPlay(training, position, "f4");
    checkTraining(training, {
      position,
      state: {
        type: "show-line-summary",
        initialPosition: frenchDefenseRootNode().initialPosition,
        line: buildLine(
          frenchDefenseRootNode().initialPosition,
          {
            move: "Nf6",
            score: "correct",
          },
          {
            move: "e5",
            score: "correct",
          },
          {
            move: "Nfd7",
            score: "correct",
          },
          {
            move: "f4",
            score: "correct",
          },
        ),
      },
      correct: 4,
      incorrect: 0,
      linesTrained: 1,
    });

    training.finishLine();
    position = frenchDefenseRootNode().initialPosition;
    tryMoveSanAndPlay(training, position, "Bb4");
    tryMoveSanAndPlay(training, position, "e5");
    checkTraining(training, {
      position,
      state: {
        type: "show-line-summary",
        initialPosition: frenchDefenseRootNode().initialPosition,
        line: buildLine(
          frenchDefenseRootNode().initialPosition,
          {
            move: "Bb4",
            score: "correct",
          },
          {
            move: "e5",
            score: "correct",
          },
        ),
      },
      correct: 6,
      incorrect: 0,
      linesTrained: 2,
    });

    training.finishLine();
    position = frenchDefenseRootNode().initialPosition;
    tryMoveSanAndPlay(training, position, "dxe4");
    tryMoveSanAndPlay(training, position, "Nxe4");
    checkTraining(training, {
      position,
      state: {
        type: "show-line-summary",
        initialPosition: frenchDefenseRootNode().initialPosition,
        line: buildLine(
          frenchDefenseRootNode().initialPosition,
          {
            move: "dxe4",
            score: "correct",
          },
          {
            move: "Nxe4",
            score: "correct",
          },
        ),
      },
      correct: 8,
      incorrect: 0,
      linesTrained: 3,
    });

    training.finishLine();
    position = frenchDefenseRootNode().initialPosition;
    tryMoveSanAndPlay(training, position, "Nf6");
    tryMoveSanAndPlay(training, position, "e5");
    tryMoveSanAndPlay(training, position, "Ne4");
    tryMoveSanAndPlay(training, position, "Nxe4");
    checkTraining(training, {
      position,
      state: {
        type: "show-line-summary",
        initialPosition: frenchDefenseRootNode().initialPosition,
        line: buildLine(
          frenchDefenseRootNode().initialPosition,
          {
            move: "Nf6",
            score: "correct",
          },
          {
            move: "e5",
            score: "correct",
          },
          {
            move: "Ne4",
            score: "correct",
          },
          {
            move: "Nxe4",
            score: "correct",
          },
        ),
      },
      correct: 12,
      incorrect: 0,
      linesTrained: 4,
    });
  });

  test("skip after", () => {
    const rootNode = buildNode({
      color: "white",
      e4: {
        e5: {
          Nf3: {},
        },
        c5: {
          Nf3: {
            d6: {
              d4: {},
            },
            Nc6: {
              Bb5: {},
            },
            e6: {
              b3: {},
            },
          },
        },
      },
    });
    const settings = {
      ...testSettings,
      skipAfter: 2,
    };
    const training = createTraining([rootNode], settings);
    let position = Chess.default();
    // First time through, all moves need to be guessed
    expect(training.state.type).toEqual("choose-move");

    tryMoveSanAndPlay(training, position, "e4");
    expect(training.state.type).toEqual("advance-after-delay");
    training.advance();
    playSan(position, "e5");
    expect(training.state.type).toEqual("choose-move");

    tryMoveSanAndPlay(training, position, "Nf3");
    expect(training.state.type).toEqual("show-line-summary");
    training.finishLine();

    // Second time through, we still need to guess all moves
    position = Chess.default();
    expect(training.state.type).toEqual("choose-move");
    tryMoveSanAndPlay(training, position, "e4");
    expect(training.state.type).toEqual("advance-after-delay");
    training.advance();
    playSan(position, "c5");
    expect(training.state.type).toEqual("choose-move");

    tryMoveSanAndPlay(training, position, "Nf3");
    expect(training.state.type).toEqual("advance-after-delay");
    training.advance();
    playSan(position, "d6");
    expect(training.state.type).toEqual("choose-move");

    tryMoveSanAndPlay(training, position, "d4");
    expect(training.state.type).toEqual("show-line-summary");
    training.finishLine();

    // 3rd time through, we don't need to guess `e4` again.
    position = Chess.default();
    expect(training.state.type).toEqual("advance-after-delay");
    playSan(position, "e4");
    training.advance();
    expect(training.state.type).toEqual("advance-after-delay");
    training.advance();
    playSan(position, "c5");
    expect(training.state.type).toEqual("choose-move");

    // Oops, we guessed wrong on this move
    tryMoveSan(training, position, "Nc3");
    expect(training.state.type).toEqual("choose-move");

    tryMoveSanAndPlay(training, position, "Nf3");
    expect(training.state.type).toEqual("show-correct-move");
    training.advance();
    playSan(position, "Nc6");
    expect(training.state.type).toEqual("choose-move");

    tryMoveSanAndPlay(training, position, "Bb5");
    expect(training.state.type).toEqual("show-line-summary");
    training.finishLine();

    // 4th time through, no need to guess e4
    position = Chess.default();
    expect(training.state.type).toEqual("advance-after-delay");
    playSan(position, "e4");
    training.advance();
    expect(training.state.type).toEqual("advance-after-delay");
    training.advance();
    playSan(position, "c5");

    // But we do need to guess Nf3, since we got it wrong the last time around.
    expect(training.state.type).toEqual("choose-move");
    tryMoveSanAndPlay(training, position, "Nf3");
    expect(training.state.type).toEqual("advance-after-delay");
    training.advance();
    playSan(position, "e6");
    expect(training.state.type).toEqual("choose-move");

    tryMoveSanAndPlay(training, position, "b3");
    expect(training.state.type).toEqual("show-line-summary");
    training.finishLine();
    expect(training.state.type).toEqual("show-training-summary");
  });
});
