import {
  Chess,
  chessgroundDests,
  makeFen,
  parseFen,
  parseSquare,
  squareFile,
  squareRank,
} from "~/lib/chess";
import type { Role } from "~/lib/chess";
import type { Api as ChessgroundApi } from "chessground/api";
import { Chessground } from "chessground";
import { createSignal, onMount, Show } from "solid-js";

import "./chessground.base.css";
import "./chessground.brown.css";
import "./chessground.cburnett.css";

interface PromotionSelectorProps {
  color: "white" | "black";
  from: number;
  to: number;
  onSelect: (role: Role) => void;
}

function PromotionSelector(props: PromotionSelectorProps) {
  return (
    <div
      class="absolute shadow-lg shadow-zinc-800 bg-zinc-300 flex flex-col"
      style={{
        width: "12.5%",
        height: "50%",
        left: `${12.5 * squareFile(props.to)}%`,
        top: `${12.5 * (7 - squareRank(props.to))}%`,
        "z-index": 100,
      }}
    >
      <button
        class={`piece-queen-${props.color} h-[25%] bg-cover hover:bg-zinc-200 dark:hover:bg-zinc-700`}
        onClick={() => props.onSelect("queen")}
      ></button>
      <button
        class={`piece-rook-${props.color} h-[25%] bg-cover hover:bg-zinc-200 dark:hover:bg-zinc-700`}
        onClick={() => props.onSelect("rook")}
      ></button>
      <button
        class={`piece-bishop-${props.color} h-[25%] bg-cover hover:bg-zinc-200 dark:hover:bg-zinc-700`}
        onClick={() => props.onSelect("bishop")}
      ></button>
      <button
        class={`piece-knight-${props.color} h-[25%] bg-cover hover:bg-zinc-200 dark:hover:bg-zinc-700`}
        onClick={() => props.onSelect("knight")}
      ></button>
    </div>
  );
}

interface BoardProps {
  fen: string;
}

interface PendingPromotionState {
  color: "white" | "black";
  from: number;
  to: number;
}

export function Board(props: BoardProps) {
  let ref!: HTMLDivElement;
  let board: ChessgroundApi;
  const [pendingPromitionState, setPendingPromitionState] =
    createSignal<PendingPromotionState>();
  const chess = Chess.fromSetup(parseFen(props.fen).unwrap()).unwrap();

  function initBoard() {
    board.set({
      fen: makeFen(chess.toSetup()),
      movable: {
        dests: chessgroundDests(chess),
      },
    });
  }

  function onPromotionSelect(role: Role | null) {
    const pendingPromotion = pendingPromitionState();
    if (!pendingPromotion) {
      return;
    }
    if (role) {
      chess.play({
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion: role,
      });
    }
    board.set({
      fen: makeFen(chess.toSetup()),
      movable: {
        dests: chessgroundDests(chess),
      },
    });
    setPendingPromitionState(undefined);
  }

  onMount(() => {
    board = Chessground(ref, {
      coordinates: false,
      movable: {
        free: false,
      },
      events: {
        move: (fromStr, toStr) => {
          const from = parseSquare(fromStr);
          if (from === undefined) {
            throw Error(`Invalid from square: ${fromStr}`);
          }
          const to = parseSquare(toStr);
          if (to === undefined) {
            throw Error(`Invalid to square: ${toStr}`);
          }
          if (
            chess.turn == "white" &&
            chess.board.get(from)?.role == "pawn" &&
            squareRank(to) == 7
          ) {
            setPendingPromitionState({ from, to, color: chess.turn });
          } else if (
            chess.turn == "black" &&
            chess.board.get(from)?.role == "pawn" &&
            squareRank(to) == 0
          ) {
            setPendingPromitionState({ from, to, color: chess.turn });
          } else {
            chess.play({ from, to });
            board.set({
              fen: makeFen(chess.toSetup()),
              movable: {
                dests: chessgroundDests(chess),
              },
            });
          }
        },
        select: (sq) => {
          console.log("select", sq);
          if (pendingPromitionState()) {
            onPromotionSelect(null);
          }
        },
      },
    });
    initBoard();
  });

  // TODO: rank and file letters
  return (
    <div class="w-full h-full relative">
      <div
        class="w-full h-full"
        classList={{
          "opacity-50": pendingPromitionState() !== undefined,
        }}
        onWheel={(evt) => console.log("wheel", Math.sign(evt.deltaY))}
        ref={ref}
      />
      <Show when={pendingPromitionState()}>
        {(state) => (
          <PromotionSelector onSelect={onPromotionSelect} {...state()} />
        )}
      </Show>
    </div>
  );
}
