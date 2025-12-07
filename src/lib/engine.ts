import type { StockfishClient } from "@lichess-org/stockfish-web/sf171-79";
import Stockfish from "@lichess-org/stockfish-web/sf171-79";
import stockfishUrl from "@lichess-org/stockfish-web/sf171-79?url";
import stockfishWasmUrl from "@lichess-org/stockfish-web/sf171-79.wasm?url";
import type { Move, Chess } from "~/lib/chess";
import { makeFen, parseSquare } from "~/lib/chess";

// - Downloaded from https://tests.stockfishchess.org/api/nn/nn-1c0000000000.nnue
// - Got the link from the README https://github.com/lichess-org/stockfish-web
// - Uploaded to assets.chessfiles.app, which is a Cloudflare R2 bucket
const nnueUrl = "https://assets.chessfiles.app/nn-1c0000000000.nnue";

export interface EngineSettings {
  enable: boolean;
  maxDepth: number | null;
  lines: number;
}

export interface Analysis {
  depth: number;
  selectiveDepth: number;
  nodes: number;
  nps: number;
  lines: Line[];
}

export interface Line {
  score: number;
  scoreType: "cp" | "mate";
  moves: Move[];
}

export type EngineObserver = (analysis: Analysis) => void;

export function getEngineSettings(): EngineSettings {
  const settings: EngineSettings = {
    enable: false,
    maxDepth: 20,
    lines: 3,
  };

  const enable = localStorage.getItem("engine-enable");
  const maxDepth = localStorage.getItem("engine-max-depth");
  const lines = localStorage.getItem("engine-lines");

  if (enable == "1") {
    settings.enable = true;
  }

  if (maxDepth == "infinite") {
    settings.maxDepth = null;
  } else if (maxDepth !== null) {
    const parsed = parseInt(maxDepth);
    if (!isNaN(parsed)) {
      settings.maxDepth = parsed;
    }
  }
  if (lines !== null) {
    const parsed = parseInt(lines);
    if (!isNaN(parsed)) {
      settings.lines = parsed;
    }
  }
  return settings;
}

export function setEngineSettings(settings: EngineSettings) {
  localStorage.setItem("engine-enable", settings.enable ? "1" : "0");
  localStorage.setItem(
    "engine-max-depth",
    settings.maxDepth ? settings.maxDepth.toString() : "infinite",
  );
  localStorage.setItem("engine-lines", settings.lines.toString());
}

export class Engine {
  observer: EngineObserver | null;
  analysis: Analysis;
  maxDepth: number | null = null;
  searchLines: number = 1;

  private constructor(private sf: Promise<StockfishClient>) {
    this.observer = null;
    this.analysis = {
      depth: 0,
      selectiveDepth: 0,
      nodes: 0,
      nps: 0,
      lines: [],
    };
    sf.then((sf) => {
      sf.listen = (data) => {
        try {
          this.onData(data);
        } catch (e) {
          console.error(`error parsing UCI line: ${e}`);
        }
      };
      sf.onError = this.onError.bind(this);
    });
  }

  private updateAnalysis(analysis: Analysis) {
    this.analysis = analysis;
    if (this.observer !== null) {
      this.observer(analysis);
    }
  }

  private resetAnalysis() {
    this.updateAnalysis({
      depth: 0,
      selectiveDepth: 0,
      nodes: 0,
      nps: 0,
      lines: [],
    });
  }

  static singleton: Engine | null;

  static get(): Engine {
    if (!this.singleton) {
      this.singleton = new Engine(getStockfish());
    }
    return this.singleton;
  }

  private onData(data: string) {
    if (!data.startsWith("info")) {
      return;
    }

    const analysis = { ...this.analysis };

    analysis.nodes = matchIntRegex(regexes.nodes, data) ?? analysis.nodes;
    analysis.nps = matchIntRegex(regexes.nps, data) ?? analysis.nps;
    analysis.depth = matchIntRegex(regexes.depth, data) ?? analysis.depth;
    analysis.selectiveDepth =
      matchIntRegex(regexes.seldepth, data) ?? analysis.selectiveDepth;
    if (analysis.depth > analysis.selectiveDepth) {
      analysis.selectiveDepth = analysis.depth;
    }

    let score = 0;
    let scoreType: "cp" | "mate" = "cp";
    const scoreMate = matchIntRegex(regexes.scoreMate, data);
    if (scoreMate) {
      score = scoreMate;
      scoreType = "mate";
    } else {
      const scoreCp = matchIntRegex(regexes.scoreCp, data);
      if (scoreCp) {
        score = scoreCp;
        scoreType = "cp";
      }
    }

    const lineIndex = (matchIntRegex(regexes.multipv, data) ?? 1) - 1;
    while (analysis.lines.length < lineIndex) {
      analysis.lines.push({
        score: 0,
        scoreType: "cp",
        moves: [],
      });
    }
    const pvMatch = data.match(regexes.pv);
    if (pvMatch !== null) {
      analysis.lines[lineIndex] = {
        score,
        scoreType,
        moves: pvMatch[1]
          .split(/\s+/)
          .filter((m) => m != "")
          .map(parseUciMove),
      };
    }

    this.updateAnalysis(analysis);
  }

  private onError(error: string) {
    console.error("stockfish error:", error);
  }

  search(chess: Chess) {
    const fen = makeFen(chess.toSetup());
    this.resetAnalysis();
    this.sf.then((sf) => {
      sf.uci("stop");
      sf.uci(`position fen ${fen}`);
      if (this.maxDepth !== null) {
        sf.uci(`go depth ${this.maxDepth}`);
      } else {
        sf.uci("go infinite");
      }
    });
  }

  stop() {
    this.resetAnalysis();
    this.sf.then((sf) => {
      sf.uci("stop");
    });
  }

  quit() {
    this.resetAnalysis();
    this.sf.then((sf) => {
      sf.uci("quit");
    });
  }

  setObserver(observer: EngineObserver | null) {
    this.observer = observer;
    if (observer !== null) {
      observer(this.analysis);
    }
  }

  setSearchLines(lines: number) {
    if (lines == this.searchLines) {
      return;
    }
    this.searchLines = lines;
    this.sf.then((sf) => {
      sf.uci("stop");
      sf.uci(`setoption name MultiPV value ${lines}`);
      if (this.maxDepth !== null) {
        sf.uci(`go depth ${this.maxDepth}`);
      } else {
        sf.uci("go infinite");
      }
    });
  }

  setMaxDepth(maxDepth: number | null) {
    this.maxDepth = maxDepth;
  }
}

const regexes = {
  depth: /depth\s+(\d+)/,
  seldepth: /seldepth\s+(\d+)/,
  multipv: /multipv\s+(\d+)/,
  nodes: /nodes\s+(\d+)/,
  nps: /nps\s+(\d+)/,
  pv: /pv\s+((([a-h][1-8][a-h][1-8][qrbn]?)\s+)+)/,
  scoreCp: /score\s+cp\s+(\d+)/,
  scoreMate: /score\s+mate\s+(\d+)/,
};

function matchIntRegex(re: RegExp, data: string): number | undefined {
  const match = data.match(re);
  if (match !== null) {
    return parseInt(match[1]);
  } else {
    return undefined;
  }
}

const uciPieceMap: Map<
  string | undefined,
  "queen" | "rook" | "bishop" | "knight" | undefined
> = new Map([
  ["q", "queen"],
  ["r", "rook"],
  ["b", "bishop"],
  ["n", "knight"],
  [undefined, undefined],
]);

function parseUciMove(move: string): Move {
  return {
    from: parseSquare(move.slice(0, 2)),
    to: parseSquare(move.slice(2, 4)),
    promotion: uciPieceMap.get(move[4]),
  };
}

function getStockfish(): Promise<StockfishClient> {
  return new Promise((resolve) => {
    // Patch Stockfish to work with vite
    Stockfish({
      locateFile: (filename: string) => {
        if (filename == "sf171-79.wasm") {
          return new URL(stockfishWasmUrl, window.location.href);
        } else {
          throw Error(`Stockfish locateFile - unknown filename: ${filename}`);
        }
      },
      mainScriptUrlOrBlob: stockfishUrl,
    }).then((sf: StockfishClient) => {
      fetch(nnueUrl).then((resp) => {
        resp.bytes().then((buf) => {
          sf.setNnueBuffer(buf);
          const uci = sf.uci.bind(sf);
          sf.uci = (command: string) => {
            console.log(command);
            uci(command);
          };
          resolve(sf);
        });
      });
    });
  });
}
