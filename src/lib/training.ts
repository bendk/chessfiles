import type { ChildNode, Node, RootNode } from "./node";
import type { TrainingActivity } from "./activity";
import { newTrainingActivity } from "./activity";
import { Book, Priority } from "./node";
import type { Move, Shape } from "./chess";
import { makeFen, makeSan, Chess } from "./chess";
import { filename } from "~/lib/storage";

export type Score = "correct" | "incorrect";

/**
 * Training session
 *
 */
export class Training {
  meta: TrainingMeta;
  state: TrainingState;
  board: TrainingBoard;
  activity: TrainingActivity;
  settings: TrainingSettings;
  private currentRootNode: RootNode | undefined;
  private rootNodesToGo: RootNode[];
  private currentLine: CurrentLineEntry[];
  private draftEntry: DraftHistoryEntry;
  private currentNode: Node | undefined;
  // Are we replying the current line because we imported an in-progress session?/
  private currentLineReplayCount = -1;
  // Maps positions seen to the number of correct moves in a row.  If this exceeds
  // settings.skipAfter, then we won't ask the user to guess the move again
  private correctStreakMap: Map<string, number> = new Map();

  constructor(
    settings: TrainingSettings,
    meta: TrainingMeta,
    rootNodes: RootNode[],
  ) {
    this.meta = meta;
    this.settings = settings;
    if (settings.shuffle) {
      shuffleArray(rootNodes);
    }
    [this.currentRootNode, ...this.rootNodesToGo] = rootNodes;
    this.currentNode = this.currentRootNode;
    this.currentLine = [];
    this.draftEntry = {
      score: null,
      incorrectTries: [],
    };
    this.activity = newTrainingActivity(meta.bookId);
    this.board = newBoard(this.currentRootNode);
    this.state = initialState(this.currentRootNode);
  }

  static create(
    settings: TrainingSettings,
    bookPath: string,
    book: Book,
  ): Training {
    const bookFilename = filename(bookPath);
    const name = bookFilename.split(".")[0];
    const meta = {
      name,
      bookPath,
      bookId: book.id(),
      settings,
      correctCount: 0,
      incorrectCount: 0,
      linesTrained: 0,
      totalLines: book.rootNodes.reduce(
        (count, node) => count + node.lineCount(),
        0,
      ),
      lastTrained: Date.now(),
    };
    return new Training(settings, meta, book.rootNodes);
  }

  restart(book: Book) {
    this.meta.correctCount = 0;
    this.meta.incorrectCount = 0;
    this.meta.linesTrained = 0;
    const rootNodes = book.rootNodes;
    if (this.settings.shuffle) {
      shuffleArray(rootNodes);
    }
    [this.currentRootNode, ...this.rootNodesToGo] = rootNodes;
  }

  advance() {
    assertIsDefined(this.currentNode);
    if (this.state.type == "show-correct-move") {
      this.board.feedback = null;
      if (this.isUsersMove() || this.currentNode.isEmpty()) {
        this.updateStateForCurrentNode();
      } else {
        const child = pickChildNode(this.currentNode, this.settings.shuffle);
        this.advanceToChild(child);
      }
      return;
    }
    if (this.state.type == "choose-move") {
      // User skipped when asked to choose a move
      this.updateCurrentScore(null, false);
    } else if (this.state.type != "advance-after-delay") {
      throw Error(`advance(): invalid state ${this.state.type}`);
    }
    const child = pickChildNode(this.currentNode, this.settings.shuffle);
    this.advanceToChild(child);
  }

  tryMove(move: Move) {
    assertIsDefined(this.currentNode);
    if (this.state.type != "choose-move") {
      throw Error(`tryMove: invalid state (${this.state.type})`);
    }
    const nodeForMove = this.currentNode.getChild(move);
    if (nodeForMove === undefined) {
      this.updateCurrentScore(move, false);
      return;
    }
    this.updateCurrentScore(move, true);
    this.advanceToChild(nodeForMove);
  }

  finishLine() {
    assertIsDefined(this.currentRootNode);
    this.removeCurrentLineFromRootNode();
    this.currentLine = [];
    if (this.currentRootNode.isEmpty()) {
      [this.currentRootNode, ...this.rootNodesToGo] = this.rootNodesToGo;
    }
    this.board = newBoard(this.currentRootNode);
    this.currentNode = this.currentRootNode;
    if (this.currentNode === undefined) {
      this.state = { type: "show-training-summary" };
    } else {
      this.updateStateForCurrentNode();
    }
  }

  updateLastScore(score: Score | null) {
    if (this.state.type != "show-correct-move") {
      throw Error(`updateLastScore: invalid state (${this.state.type})`);
    }
    const entry = this.currentLine.at(-1);
    if (entry === undefined) {
      throw Error("No history entry");
    }
    if (entry.score == "correct") {
      this.meta.correctCount--;
      this.activity.correctCount--;
    } else if (entry.score == "incorrect") {
      this.meta.incorrectCount--;
      this.activity.incorrectCount--;
    }
    if (score == "correct") {
      this.meta.correctCount++;
      this.activity.correctCount++;
    } else if (score == "incorrect") {
      this.meta.incorrectCount++;
      this.activity.incorrectCount++;
    }
    this.state.score = score;
    entry.score = score;
  }

  private advanceToChild(child: ChildNode) {
    assertIsDefined(this.currentRootNode);
    if (this.currentLineReplayCount < 0) {
      this.updateStreak();
    }
    const moveSan = makeSan(this.board.position, child.move);

    this.board.position.play(child.move);
    this.board.lastMove = child.move;
    this.board.comment = child.comment ?? "";
    this.board.shapes = child.shapes ?? [];
    this.board.feedback = null;
    this.currentNode = child;
    const wasIncorrect = this.draftEntry.score == "incorrect";
    if (this.currentLineReplayCount >= 0) {
      // Replaying moves after an import:
      // * Don't push to `this.currentLine`.
      // * Choose "advance-after-delay", except for the last pass
      this.currentLineReplayCount--;
      if (this.currentLineReplayCount >= 0) {
        this.state = {
          type: "advance-after-delay",
        };
        return;
      }
    } else {
      this.currentLine.push({
        ...this.draftEntry,
        move: child.move,
      });
      this.draftEntry = {
        score: null,
        incorrectTries: [],
      };
    }

    if (wasIncorrect) {
      this.state = {
        type: "show-correct-move",
        score: "incorrect",
        correctMove: moveSan,
        wrongMoves:
          this.state.type == "choose-move" ? this.state.wrongMoves : [],
      };
      this.board.feedback = {
        type: "correct",
        move: child.move,
      };
    } else {
      this.updateStateForCurrentNode();
    }
  }
  private updateStateForCurrentNode() {
    assertIsDefined(this.currentNode);
    assertIsDefined(this.currentRootNode);
    if (this.currentNode.isEmpty()) {
      this.meta.linesTrained++;
      this.state = {
        type: "show-line-summary",
        initialPosition: this.currentRootNode.initialPosition.clone(),
        line: [...this.currentLine],
      };
    } else if (this.isUsersMove() && !this.shouldSkipUserMove()) {
      this.state = {
        type: "choose-move",
        wrongMoves: [],
      };
    } else {
      this.state = {
        type: "advance-after-delay",
      };
    }
  }

  private isUsersMove(): boolean {
    assertIsDefined(this.currentRootNode);
    return (
      this.currentRootNode.color === undefined ||
      this.currentRootNode.color == this.board.position.turn
    );
  }

  private updateStreak() {
    const fen = makeFen(this.board.position.toSetup());
    if (this.draftEntry.score == "correct") {
      const current = this.correctStreakMap.get(fen) ?? 0;
      this.correctStreakMap.set(fen, current + 1);
    } else if (this.draftEntry.score == "incorrect") {
      this.correctStreakMap.set(fen, 0);
    }
  }

  private shouldSkipUserMove() {
    const fen = makeFen(this.board.position.toSetup());
    const count = this.correctStreakMap.get(fen) ?? 0;
    return count >= this.settings.skipAfter;
  }

  private updateCurrentScore(move: Move | null, correct: boolean) {
    if (this.state.type != "choose-move") {
      throw Error(`updateCurrentScore: invalid state (${this.state.type})`);
    }
    if (!correct && move !== null) {
      const moveSan = makeSan(this.board.position, move);
      const wrongMoves = this.state.wrongMoves ?? [];

      if (wrongMoves.indexOf(moveSan) == -1) {
        this.draftEntry.incorrectTries.push(move);
        wrongMoves.push(moveSan);
        this.state.wrongMoves = wrongMoves;
      }
    }

    if (this.draftEntry.score === null) {
      if (correct) {
        this.draftEntry.score = "correct";
        this.meta.correctCount++;
        this.activity.correctCount++;
      } else {
        this.draftEntry.score = "incorrect";
        this.meta.incorrectCount++;
        this.activity.incorrectCount++;
      }
    }

    if (this.draftEntry.score !== null && move !== null) {
      this.board.feedback = {
        type: this.draftEntry.score,
        move: move,
      };
    } else {
      this.board.feedback = null;
    }
  }

  private removeCurrentLineFromRootNode() {
    assertIsDefined(this.currentRootNode);
    let lastBranch: [Node, Move] | null = null;

    let node: Node | undefined = this.currentRootNode;
    for (const entry of this.currentLine) {
      assertIsDefined(node);
      const move = entry.move;
      if (node.children.length > 1) {
        lastBranch = [node, move];
      }
      const child = node.getChild(move);
      node = child;
    }

    if (lastBranch !== null) {
      lastBranch[0].removeChild(lastBranch[1]);
    } else {
      // No branches found, remove the last move from the root node
      this.currentRootNode.children = [];
    }
  }

  export(): string {
    return JSON.stringify({
      meta: this.meta,
      currentLine: this.currentLine,
      rootNodesPgn: [
        this.currentRootNode?.toPgnString(),
        ...this.rootNodesToGo.map((node) => node.toPgnString()),
      ],
    });
  }

  static import(data: string, settings: TrainingSettings): Training {
    const { meta, currentLine, rootNodesPgn } = JSON.parse(data);
    const rootNodes = rootNodesPgn.map(
      (pgn: string) => Book.import(pgn).rootNodes[0],
    );
    const training = new Training(settings, meta, rootNodes);
    training.currentLine = currentLine;
    if (training.currentLine.length > 0) {
      training.currentLineReplayCount = training.currentLine.length - 1;
      training.state = { type: "advance-after-delay" };
    }
    return training;
  }
}

function initialState(rootNode: RootNode | undefined): TrainingState {
  if (rootNode === undefined) {
    return { type: "show-training-summary" };
  }
  if (
    rootNode.color === undefined ||
    rootNode.color == rootNode.initialPosition.turn
  ) {
    return { type: "choose-move", wrongMoves: [] };
  } else {
    return { type: "advance-after-delay" };
  }
}

/**
 * Settings for training sessions
 */
export interface TrainingSettings {
  /// Skip the choose-move state after for positions that have been seen this many times
  /// `0` indicates we should always go to choose-move
  skipAfter: number;
  /// Should we shuffle the lines??
  shuffle: boolean;
}

export function defaultTrainingSettings(): TrainingSettings {
  return {
    skipAfter: 2,
    shuffle: true,
  };
}

/**
 * Metadata about a training session
 *
 * These are stored together in the `ChessFiles.index` file.
 */
export interface TrainingMeta {
  bookPath: string;
  bookId: string;
  name: string;
  correctCount: number;
  incorrectCount: number;
  linesTrained: number;
  totalLines: number;
  lastTrained: number;
}

/**
 * Wait a short delay, then call `advance()`
 *
 * This allows us to animate moves on the board.
 */
export interface TrainingStateMoveAfterDelay {
  type: "advance-after-delay";
}

/**
 * Let the user try to choose the correct move then call `tryMove` with the choice.
 *
 * `wrongMoves` will be set if the user has already chosen an incorrect move for this position.
 */
export interface TrainingStateChooseMove {
  type: "choose-move";
  wrongMoves: string[];
}

/**
 * Show the user the correct move
 *
 * This happens after the user chooses the wrong move, then advances forward.  Once the user is
 * ready, call `advance()`.
 */
export interface TrainingStateShowCorrectMove {
  type: "show-correct-move";
  score: Score | null;
  correctMove: string;
  wrongMoves: string[];
}

/**
 * Show a summary of the entire line.
 *
 * Once the user is ready to move on, call `advance()`.
 */
export interface TrainingStateShowLineSummary {
  type: "show-line-summary";
  initialPosition: Chess;
  line: readonly CurrentLineEntry[];
}

/**
 * Show a summary of the entire training
 *
 * This is the final step for a training.  After this, either delete the training or reset it by
 * calling `newTraining` and saving that data.
 */
export interface TrainingStateShowSummary {
  type: "show-training-summary";
}

export type TrainingState =
  | TrainingStateMoveAfterDelay
  | TrainingStateChooseMove
  | TrainingStateShowCorrectMove
  | TrainingStateShowLineSummary
  | TrainingStateShowSummary;

/**
 * Represents the board that's displayed
 */
export interface TrainingBoard {
  position: Chess;
  lastMove?: Move;
  feedback: TrainingBoardFeedback | null;
  comment: string;
  shapes: readonly Shape[];
}

function newBoard(rootNode: RootNode | undefined): TrainingBoard {
  if (rootNode === undefined) {
    return {
      position: Chess.default(),
      feedback: null,
      comment: "",
      shapes: [],
    };
  }
  return {
    position: rootNode.initialPosition.clone(),
    feedback: null,
    comment: rootNode.comment ?? "",
    shapes: [],
  };
}

export interface TrainingBoardFeedback {
  type: Score;
  move: Move;
}

/**
 * Entry in the history array
 */
export interface CurrentLineEntry {
  move: Move;
  score: Score | null;
  incorrectTries: Move[];
}

type DraftHistoryEntry = Omit<CurrentLineEntry, "move">;

/**
 * Pick the next move of a training line
 *
 * Prioritize moves based on the priority of the final move in each line from the node
 *
 * Used to pick a random move from a node, where each weight is the number of lines for that move.
 */
function pickChildNode(node: Node, shuffle: boolean): ChildNode {
  const lineCountsTrainFirst: Map<ChildNode, number> = new Map();
  const lineCountsDefault: Map<ChildNode, number> = new Map();
  const lineCountsTrainLast: Map<ChildNode, number> = new Map();

  for (const child of node.children) {
    const allCounts = child.lineCountByPriority();
    if (allCounts[Priority.TrainFirst] > 0) {
      lineCountsTrainFirst.set(child, allCounts[Priority.TrainFirst]);
    }
    if (allCounts[Priority.Default] > 0) {
      lineCountsDefault.set(child, allCounts[Priority.Default]);
    }
    if (allCounts[Priority.TrainLast] > 0) {
      lineCountsTrainLast.set(child, allCounts[Priority.TrainLast]);
    }
  }

  const lineCountsInPriorityOrder = [
    lineCountsTrainFirst,
    lineCountsDefault,
    lineCountsTrainLast,
  ];
  for (const lineCounts of lineCountsInPriorityOrder) {
    if (lineCounts.size > 0) {
      if (shuffle) {
        return pickChildRandomly(lineCounts);
      } else {
        for (const move of lineCounts.keys()) {
          return move;
        }
      }
    }
  }

  throw Error("TrainingReducer.pickChildNode(): all lines counts are 0");
}

/**
 * Pick a move randomly, but with each move having a different weight
 *
 * Used to pick a random move from a node, where each weight is the number of lines for that move.
 */
function pickChildRandomly(moveMap: Map<ChildNode, number>): ChildNode {
  if (moveMap.size == 0) {
    throw Error("TrainingReducer.pickChildRandomly(): no moves to pick from");
  }
  let totalWeight = 0;
  for (const weight of moveMap.values()) {
    totalWeight += weight;
  }
  let choice = Math.floor(Math.random() * totalWeight);

  for (const [move, weight] of moveMap.entries()) {
    if (choice < weight) {
      return move;
    } else {
      choice -= weight;
    }
  }

  throw Error("pickMoveRandomly: failed to pick a move");
}

/**
 * Implementation of Durstenfeld shuffle
 *
 * Used to shuffle books and endgame positions when training
 *
 * From: https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
 */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function assertIsDefined<T>(val: T): asserts val is NonNullable<T> {
  if (val === undefined || val === null) {
    throw new Error(`Expected 'val' to be defined, but received ${val}`);
  }
}

export function trainingTimeAgo(meta: TrainingMeta, currentTimestamp: number) {
  if (meta.lastTrained === undefined) {
    return "never";
  }
  // Do some basic checking that the meta doesn't have a future timestamp because it was
  // stored by a client with a weird clock
  const seconds = Math.max((currentTimestamp - meta.lastTrained) / 1000, 0);
  const table: [number, string, string][] = [
    [604800, "week", "weeks"],
    [86400, "day", "days"],
    [3600, "hour", "hours"],
    [60, "minute", "minutes"],
  ];

  for (const [amount, singular, plural] of table) {
    if (seconds >= amount) {
      const count = Math.round(seconds / amount);
      if (count === 1) {
        return `${count} ${singular} ago`;
      } else {
        return `${count} ${plural} ago`;
      }
    }
  }
  return "now";
}
