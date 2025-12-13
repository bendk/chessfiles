import type { Chess, Move } from "~/lib/chess";
import { makeFen, parseSan } from "~/lib/chess";

export interface TablebaseSettings {
  enable: boolean;
  kind: TablebaseKind;
}

// TODO support other tablebases
export type TablebaseKind = "lichess";

export interface TablebaseLookup {
  winningMoves: TablebaseMove[];
  drawingMoves: TablebaseMove[];
  losingMoves: TablebaseMove[];
  unknownMoves: TablebaseMove[];
}

export interface TablebaseMove {
  move: Move;
  san: string;
  dtz: number | null;
  dtm: number | null;
}

export function getTablebaseSettings(): TablebaseSettings {
  const settings: TablebaseSettings = {
    enable: false,
    kind: "lichess",
  };

  const enable = localStorage.getItem("tablebase-enable");
  const kind = localStorage.getItem("tablebase-kind");

  if (enable == "1") {
    settings.enable = true;
  }

  if (isTablebaseKind(kind)) {
    settings.kind = kind;
  }

  return settings;
}

export function setTablebaseSettings(settings: TablebaseSettings) {
  localStorage.setItem("tablebase-enable", settings.enable ? "1" : "0");
  localStorage.setItem("tablebase-kind", settings.kind);
}

export function isTablebaseKind(kind: string | null): kind is TablebaseKind {
  return kind == "lichess";
}

export const ALL_TABLEBASE_KINDS: TablebaseKind[] = ["lichess"];

export function tablebaseLabel(kind: TablebaseKind): string {
  if (kind == "lichess") {
    return "Lichess";
  }
  throw Error(`Invalid tablebase kind: ${kind}`);
}

export async function lookupTablebasePosition(
  kind: TablebaseKind,
  position: Chess,
): Promise<TablebaseLookup> {
  if (kind == "lichess") {
    return lookupTablebasePositionLichess(position);
  } else {
    throw Error(`Invalid tablebase kind: ${kind}`);
  }
}

export async function lookupTablebasePositionLichess(
  position: Chess,
): Promise<TablebaseLookup> {
  const params = new URLSearchParams();
  params.set("fen", makeFen(position.toSetup()));
  params.set("dtc", "auxiliary");
  const url = `https://tablebase.lichess.ovh/standard?${params.toString()}`;
  const response = await fetch(url);
  const data = await response.json();

  const lookup: TablebaseLookup = {
    winningMoves: [],
    drawingMoves: [],
    losingMoves: [],
    unknownMoves: [],
  };

  for (const m of data.moves) {
    const move: TablebaseMove = {
      move: parseSan(position, m.san),
      san: m.san,
      // negate these, to make them from the perspective of the current move
      dtz: m.dtz ? Math.abs(m.dtz) : null,
      dtm: m.dtm ? Math.abs(m.dtm) : null,
    };

    if (
      m.category == "win" ||
      m.category == "syzygy-win" ||
      m.category == "maybe-win" ||
      m.category == "cursed-win"
    ) {
      lookup.losingMoves.push(move);
    } else if (
      m.category == "loss" ||
      m.category == "syzygy-loss" ||
      m.category == "maybe-loss" ||
      m.category == "blessed-loss"
    ) {
      lookup.winningMoves.push(move);
    } else if (m.category == "draw") {
      if (lookup.drawingMoves.length < 10) {
        lookup.drawingMoves.push(move);
      }
    } else {
      if (lookup.unknownMoves.length < 10) {
        lookup.unknownMoves.push(move);
      }
    }
  }

  return lookup;
}
