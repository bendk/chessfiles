import { lichess } from "~/lib/auth";
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
  id: GameIdentifier;
}

export interface TopGamePlayer {
  name: string;
  rating: number;
}

export type GameIdentifier = {
  type: "lichess";
  id: string;
};

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
  const response = await fetchLichess(url);
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
    year: g.year,
    winner: g.winner,
    move,
    san: makeSan(position, move),
    url: `https://lichess.org/${g.id}`,
    id: {
      type: "lichess",
      id: g.id,
    },
  };
}

export async function fetchPgn(game: GameIdentifier): Promise<string> {
  if (game.type == "lichess") {
    return fetchPgnLichess(game.id);
  }
  throw Error(`invalid game identifier ${game}`);
}

async function fetchPgnLichess(id: string): Promise<string> {
  const url = "https://lichess.org/api/games/export/_ids";
  const response = await fetchLichess(url, {
    method: "POST",
    body: id,
  });
  return await response.text();
}

async function fetchLichess(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const headers = lichess.authHeaders();
  options = options ?? {};
  // The auth headers should always be set if we get here.
  // If not, we'll skip adding them to the request and probably get a 404
  if (headers !== null) {
    if (options.headers === undefined) {
      options.headers = headers;
    } else if (options.headers instanceof Headers) {
      for (const [key, value] of headers.values()) {
        options.headers.append(key, value);
      }
    } else {
      console.warn("fetchLichess: invalid options.headers: ${options.headers}");
    }
  } else {
    console.warn("fetchLichess: no auth headers");
  }
  return fetch(url, options);
}
