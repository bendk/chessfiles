import * as pgn from "chessops/pgn";

import { Chess } from "chessops/chess";
import { type NormalMove as Move } from "chessops/types";
import {
  parseSan as chessParseSan,
  makeSan,
  makeSanAndPlay,
} from "chessops/san";
import { moveEquals, parseSquare } from "chessops/util";

type Shape = pgn.CommentShape;
type ShapeColor = pgn.CommentShapeColor;
type PgnGame = pgn.Game<pgn.PgnNodeData>;
type PgnNode = pgn.Node<pgn.PgnNodeData>;
type PgnChildNode = pgn.ChildNode<pgn.PgnNodeData>;
const pgnToString = pgn.makePgn;
const pgnParseComment = pgn.parseComment;

export {
  makeSan,
  makeSanAndPlay,
  moveEquals,
  parseSquare,
  pgnParseComment,
  pgnToString,
  Chess,
};
export type { Move, PgnGame, PgnChildNode, PgnNode, Shape, ShapeColor };
export { chessgroundDests } from "chessops/compat";
export { makeFen, parseFen, INITIAL_FEN } from "chessops/fen";
export type { Role } from "chessops/types";
export { squareFile, squareRank } from "chessops/util";

export function parseSan(position: Chess, san: string): Move {
  const move = chessParseSan(position, san);
  if (!(move && "from" in move)) {
    throw Error(`Invalid move: ${san}`);
  }
  return move;
}

export function shapeEquals(left: Shape, right: Shape): boolean {
  return (
    left.to == right.to && left.from == right.from && left.color == right.color
  );
}

export function newPgnGame(
  headers: Map<string, string>,
  children: PgnChildNode[],
  comment?: string,
): PgnGame {
  const moves = new pgn.Node<pgn.PgnNodeData>();
  moves.children = children;
  return {
    headers,
    comments: comment ? [comment] : undefined,
    moves,
  };
}

export function pgnStartingPosition(game: PgnGame): Chess {
  return pgn.startingPosition(game.headers).unwrap();
}

export interface PgnNodeData {
  comment?: string;
  shapes?: readonly Shape[];
  nags?: readonly number[];
}

export function newPgnChildNode(
  san: string,
  children: PgnChildNode[],
  data: PgnNodeData,
): PgnChildNode {
  const pgnData: pgn.PgnNodeData = { san };
  const comments = [];
  if (data.comment && data.comment.length > 0) {
    comments.push(data.comment);
  }
  if (data.shapes) {
    comments.push(pgn.makeComment({ shapes: [...data.shapes] }));
  }
  if (comments.length > 0) {
    pgnData.comments = comments;
  }
  if (data.nags && data.nags.length > 0) {
    pgnData.nags = [...data.nags];
  }
  const node = new pgn.ChildNode(pgnData);
  node.children = children;
  return node;
}

/**
 * NAG value (Numeric Annotation Glyph)
 */
export const enum Nag {
  GoodMove = 1,
  PoorMove = 2,
  BrilliantMove = 3,
  BlunderMove = 4,
  InterestingMove = 5,
  DubiousMove = 6,
  ForcedMove = 7,
  EqualPosition = 10,
  UnclearPosition = 13,
  PlusEqualsPosition = 14,
  EqualsPlusPosition = 15,
  PlusMinusPosition = 16,
  MinusPlusPosition = 17,
  PlusOverMinusPosition = 18,
  MinusOverPlusPosition = 19,
}

export const MOVE_NAGS = new Set([
  Nag.GoodMove,
  Nag.PoorMove,
  Nag.BrilliantMove,
  Nag.BlunderMove,
  Nag.InterestingMove,
  Nag.DubiousMove,
  Nag.ForcedMove,
]);

export const POSITION_NAGS = new Set([
  Nag.EqualPosition,
  Nag.UnclearPosition,
  Nag.PlusEqualsPosition,
  Nag.EqualsPlusPosition,
  Nag.PlusMinusPosition,
  Nag.MinusPlusPosition,
  Nag.PlusOverMinusPosition,
  Nag.MinusOverPlusPosition,
]);

const nagTextMap = new Map<Nag, string>();
nagTextMap.set(Nag.BrilliantMove, "!!");
nagTextMap.set(Nag.GoodMove, "!");
nagTextMap.set(Nag.InterestingMove, "!?");
nagTextMap.set(Nag.DubiousMove, "?!");
nagTextMap.set(Nag.PoorMove, "?");
nagTextMap.set(Nag.BlunderMove, "??");
nagTextMap.set(Nag.PlusMinusPosition, "+-");
nagTextMap.set(Nag.PlusEqualsPosition, "+");
nagTextMap.set(Nag.EqualPosition, "=");
nagTextMap.set(Nag.UnclearPosition, "\u221E");
nagTextMap.set(Nag.EqualsPlusPosition, "=+");
nagTextMap.set(Nag.MinusPlusPosition, "-+");

/**
 * Get a text string for a NAG
 */
export function nagText(nag: Nag): string {
  return nagTextMap.get(nag) ?? "";
}
