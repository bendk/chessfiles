import type { ChildNode, Node, RootNode, Book } from "./node";
import type { TrainingActivity } from "./activity";
import { newTrainingActivity } from "./activity";
import { futureTimeDisplay, pastTimeDisplay } from "./util";
import { Priority } from "./node";
import type { Move, Shape } from "./chess";
import { makeFen, makeSan, normalizeMove, Chess } from "./chess";

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
  currentRootNode: RootNode | undefined;
  currentLine: CurrentLineEntry[];
  rootNodesToGo: RootNode[];
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
    currentRootNode: RootNode | undefined,
    rootNodesToGo: RootNode[],
  ) {
    this.meta = meta;
    this.settings = settings;
    if (settings.shuffle) {
      shuffleArray(rootNodesToGo);
    }
    this.currentRootNode = currentRootNode;
    this.rootNodesToGo = rootNodesToGo;
    if (this.currentRootNode === undefined && this.rootNodesToGo.length > 0) {
      [this.currentRootNode, ...this.rootNodesToGo] = this.rootNodesToGo;
    }

    this.currentNode = this.currentRootNode;
    this.currentLine = [];
    this.draftEntry = {
      score: null,
      incorrectTries: [],
    };
    this.activity = newTrainingActivity(meta.name);
    this.board = newBoard(this.currentRootNode);
    this.state = initialState(this.currentRootNode);
  }

  restart(book: Book): Training {
    const rootNodes = book.rootNodes
      .filter((n) => n.isTraining())
      .map((n) => n.clone());
    return new Training(
      this.settings,
      {
        ...this.meta,
        correctCount: 0,
        incorrectCount: 0,
        linesTrained: 0,
        totalLines: rootNodes.reduce(
          (count, node) => count + node.lineCount(),
          0,
        ),
        lastTrained: Date.now(),
      },
      undefined,
      rootNodes,
    );
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
    move = normalizeMove(this.board.position, move);
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

  finishLine(updateMetaRank = true) {
    assertIsDefined(this.currentRootNode);
    this.removeCurrentLineFromRootNode();
    this.currentLine = [];
    if (this.currentRootNode.isEmpty()) {
      [this.currentRootNode, ...this.rootNodesToGo] = this.rootNodesToGo;
    }
    this.board = newBoard(this.currentRootNode);
    this.currentNode = this.currentRootNode;
    if (this.currentNode === undefined) {
      const startingRank = this.meta.rank;
      if (updateMetaRank && this.meta.incorrectCount == 0) {
        this.meta = updateRank(this.meta, Date.now());
      }
      this.state = {
        type: "show-training-summary",
        gainedRank: this.meta.rank > startingRank,
      };
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
      this.activity.linesTrained++;
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
      this.currentRootNode.color() === undefined ||
      this.currentRootNode.color() == this.board.position.turn
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
    if (this.settings.skipAfter == 0) {
      return false;
    }
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

  private rootNodeHasMovesAfterCurrentLine() {
    assertIsDefined(this.currentRootNode);

    let node: Node | undefined = this.currentRootNode;
    for (const entry of this.currentLine) {
      assertIsDefined(node);
      const move = entry.move;
      const child = node.getChild(move);
      node = child;
    }
    assertIsDefined(node);
    return node.children.length > 0;
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

  /**
   * Resume an in-progress training session
   */
  resume(currentLine: CurrentLineEntry[]) {
    this.currentLine = currentLine;

    if (this.currentLine.length > 0) {
      if (!this.rootNodeHasMovesAfterCurrentLine()) {
        this.finishLine(false);
      } else {
        this.currentLineReplayCount = this.currentLine.length - 1;
        this.state = { type: "advance-after-delay" };
      }
    }
  }
}

function initialState(rootNode: RootNode | undefined): TrainingState {
  if (rootNode === undefined) {
    return {
      type: "show-training-summary",
      gainedRank: false,
    };
  }
  if (
    rootNode.color() === undefined ||
    rootNode.color() == rootNode.initialPosition.turn
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
  /// Amount of time to delay before making a move
  moveDelay: number;
  /// Skip the choose-move state after for positions that have been seen this many times
  /// `0` indicates we should always go to choose-move
  skipAfter: number;
  /// Should we shuffle the lines??
  shuffle: boolean;
}

export function defaultTrainingSettings(): TrainingSettings {
  return {
    moveDelay: 0.5,
    skipAfter: 2,
    shuffle: true,
  };
}

/**
 * Metadata about a training session
 *
 * This is stored in the book and cached in ChessfilesData.json.
 */
export interface TrainingMeta {
  // When adding fields, make sure to also update:
  //   - newTrainingMeta
  //   - fixupLoadedTrainingMeta
  //   - trainingMetaEquals
  active: boolean;
  name: string;
  correctCount: number;
  incorrectCount: number;
  linesTrained: number;
  rank: number;
  totalLines: number;
  lastTrained: number;
  lastGainedRank: number;
  trainingCount: number;
}

export const TrainingRank = {
  Silver1: 0,
  Silver2: 1,
  Silver3: 2,
  Silver4: 3,
  Gold1: 4,
  Gold2: 5,
  Gold3: 6,
  Gold4: 7,
  Diamond1: 8,
  Diamond2: 9,
  Diamond3: 10,
  Diamond4: 11,
} as const;

export function trainingMetaEquals(
  training1: TrainingMeta,
  training2: TrainingMeta,
): boolean {
  return (
    training1.active == training2.active &&
    training1.name == training2.name &&
    training1.correctCount == training2.correctCount &&
    training1.incorrectCount == training2.incorrectCount &&
    training1.linesTrained == training2.linesTrained &&
    training1.rank == training2.rank &&
    training1.totalLines == training2.totalLines &&
    training1.lastTrained == training2.lastTrained &&
    training1.lastGainedRank == training2.lastGainedRank &&
    training1.trainingCount == training2.trainingCount
  );
}

export function newTrainingMeta(name: string, book: Book): TrainingMeta {
  return {
    active: false,
    name,
    rank: TrainingRank.Silver1,
    correctCount: 0,
    incorrectCount: 0,
    linesTrained: 0,
    totalLines: book.trainingLineCount(),
    lastTrained: Date.now(),
    lastGainedRank: 0,
    trainingCount: 0,
  };
}

// Fixup a TrainingMeta just loaded from disk
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fixupLoadedTrainingMeta(meta: any): TrainingMeta {
  return {
    // Default values for metas that are missing them
    active: true,
    correctCount: 0,
    incorrectCount: 0,
    linesTrained: 0,
    rank: 0,
    totalLines: 0,
    lastTrained: 0,
    lastGainedRank: 0,
    ...meta,
  };
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
  gainedRank: boolean;
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

export function trainingTimeAgo(
  timestamp: number | undefined,
  currentTimestamp: number,
) {
  return pastTimeDisplay(timestamp, currentTimestamp);
}

export function updateRank(meta: TrainingMeta, now: number): TrainingMeta {
  // clamp meta.lastGainedRank to handle wonky clocks
  if (meta.lastGainedRank > now) {
    meta = {
      ...meta,
      lastGainedRank: now,
    };
  }

  const next = nextRankAvailableTime(meta, now);
  if (next !== null && next <= now) {
    meta = {
      ...meta,
      lastGainedRank: now,
      rank: meta.rank + 1,
    };
  }

  return meta;
}

function nextRankAvailableTime(meta: TrainingMeta, now: number): number | null {
  const one_day = 86_400_000;
  switch (meta.rank) {
    // Silver has no cooldown
    case TrainingRank.Silver1:
    case TrainingRank.Silver2:
    case TrainingRank.Silver3:
    case TrainingRank.Silver4:
      return now;

    // Gold has a 7 day cooldown before gaining additional ranks
    case TrainingRank.Gold1:
    case TrainingRank.Gold2:
    case TrainingRank.Gold3:
    case TrainingRank.Gold4:
      return Math.max(meta.lastGainedRank + one_day * 7, now);

    // Diamond has a 30 day cooldown before gaining additional ranks
    case TrainingRank.Diamond1:
    case TrainingRank.Diamond2:
    case TrainingRank.Diamond3:
      return Math.max(meta.lastGainedRank + one_day * 30, now);

    // Can't advance past diamond 4
    default:
      return null;
  }
}

export function nextRankAvailableTimeDisplay(
  meta: TrainingMeta,
  now?: number,
): string {
  if (now === undefined) {
    now = Date.now();
  }
  const nextTime = nextRankAvailableTime(meta, now);
  if (nextTime == null) {
    return "Never";
  }
  return futureTimeDisplay(nextTime, now);
}

export function lastTrainedTimeDisplay(
  meta: TrainingMeta,
  now?: number,
): string {
  if (now === undefined) {
    now = Date.now();
  }
  return pastTimeDisplay(meta.lastTrained, now);
}
