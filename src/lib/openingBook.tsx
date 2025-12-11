import type { Chess, Move, Color } from "~/lib/chess";
import { makeFen, makeSan, parseSan, parseUciMove } from "~/lib/chess";

export interface OpeningBookSettings {
  enable: boolean;
  kind: OpeningBookKind;
}

export type OpeningBookKind = "lichess-big" | "lichess-masters";

export interface OpeningBookLookup {
  whiteWinCount: number;
  drawCount: number;
  blackWinCount: number;
  gameCount: number;
  moves: OpeningBookMove[];
  topGames: TopGame[];
}

export interface OpeningBookMove {
  move: Move;
  san: string;
  gamePercent: string;
  gameCount: number;
  whiteWinCount: number;
  drawCount: number;
  blackWinCount: number;
  whiteWinRatio: number;
  drawRatio: number;
  blackWinRatio: number;
}

export interface TopGame {
  white: TopGamePlayer;
  black: TopGamePlayer;
  winner: Color | null;
  move: Move;
  san: string;
  year: number;
  url: string;
}

export interface TopGamePlayer {
  name: string;
  rating: number;
}

export function getOpeningBookSettings(): OpeningBookSettings {
  const settings: OpeningBookSettings = {
    enable: false,
    kind: "lichess-masters",
  };

  const enable = localStorage.getItem("opening-book-enable");
  const kind = localStorage.getItem("opening-book-kind");

  if (enable == "1") {
    settings.enable = true;
  }

  if (isOpeningBookKind(kind)) {
    settings.kind = kind;
  }

  return settings;
}

export function setOpeningBookSettings(settings: OpeningBookSettings) {
  localStorage.setItem("opening-book-enable", settings.enable ? "1" : "0");
  localStorage.setItem("opening-book-kind", settings.kind);
}

export function isOpeningBookKind(
  kind: string | null,
): kind is OpeningBookKind {
  return kind == "lichess-masters" || kind == "lichess-big";
}

export const ALL_OPENING_BOOK_KINDS: OpeningBookKind[] = [
  "lichess-masters",
  "lichess-big",
];

export function openingBookLabel(kind: OpeningBookKind): string {
  if (kind == "lichess-big") {
    return "Lichess all games";
  } else if (kind == "lichess-masters") {
    return "Lichess master games";
  }
  throw Error(`Invalid opening book kind: ${kind}`);
}

export async function lookupOpeningPosition(
  kind: OpeningBookKind,
  position: Chess,
): Promise<OpeningBookLookup> {
  if (kind == "lichess-masters") {
    return lookupOpeningLichess(true, position);
  } else if (kind == "lichess-big") {
    return lookupOpeningLichess(false, position);
  } else {
    throw Error(`Invalid opening book kind: ${kind}`);
  }
}

export async function lookupOpeningLichess(
  masters: boolean,
  position: Chess,
): Promise<OpeningBookLookup> {
  const params = new URLSearchParams();
  params.set("fen", makeFen(position.toSetup()));
  params.set("topGames", "10");
  const url = `https://explorer.lichess.ovh/${masters ? "masters" : "lichess"}?${params.toString()}`;
  const response = await fetch(url);
  const data = await response.json();
  const totalGames = data.white + data.draws + data.black;
  return {
    whiteWinCount: data.white,
    drawCount: data.draws,
    blackWinCount: data.black,
    gameCount: totalGames,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    moves: data.moves.map((m: any) => mapMove(position, totalGames, m)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    topGames: data.topGames.map((g: any) => mapTopGame(position, g)),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMove(position: Chess, totalGames: number, m: any): OpeningBookMove {
  const gameCount = m.white + m.draws + m.black;
  return {
    move: parseSan(position, m.san),
    san: m.san,
    gamePercent: `${((100 * gameCount) / totalGames).toFixed(1)}%`,
    gameCount,
    whiteWinCount: m.white,
    drawCount: m.draws,
    blackWinCount: m.black,
    whiteWinRatio: m.white / gameCount,
    drawRatio: m.draws / gameCount,
    blackWinRatio: m.black / gameCount,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTopGame(position: Chess, g: any): TopGame {
  const move = parseUciMove(g.uci);
  return {
    white: g.white,
    black: g.black,
    winner: g.winner,
    move,
    san: makeSan(position, move),
    url: `https://lichess.org/${g.id}`,
    year: g.year,
  };
}
