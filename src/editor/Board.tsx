import {
  chessgroundDests,
  makeFen,
  parseSquare,
  squareFile,
  squareRank,
} from "~/lib/chess";
import type { Move, Role, Chess } from "~/lib/chess";
import type { Api as ChessgroundApi } from "chessground/api";
import { Chessground } from "chessground";
import { createSignal, createEffect, Show } from "solid-js";

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
      class="absolute shadow-lg shadow-zinc-800 bg-zinc-300 flex"
      classList={{
        "flex-col": props.color == "white",
        "flex-col-reverse": props.color == "black",
      }}
      style={{
        width: "12.5%",
        height: "50%",
        left: `${12.5 * squareFile(props.to)}%`,
        top: props.color == "white" ? 0 : "50%",
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
  chess: Chess;
  onMove: (move: Move) => void;
  onMoveBackwards: () => void;
  onMoveForwards: () => void;
}

interface PendingPromotionState {
  color: "white" | "black";
  from: number;
  to: number;
}

export function Board(props: BoardProps) {
  let ref!: HTMLDivElement;
  let board: ChessgroundApi;
  const [pendingPromotionState, setPendingPromotionState] =
    createSignal<PendingPromotionState>();

  // Make the board match the current `props.chess` value.  This is how we initialize the board and
  // react to changes to `props.chess`.
  function syncBoard() {
    if (!board) {
      board = Chessground(ref, {
        coordinates: false,
        movable: {
          free: false,
        },
        events: {
          move: onMove,
          select: () => {
            if (pendingPromotionState()) {
              onPromotionSelect(null);
            }
          },
        },
      });
    }
    if (board) {
      board.set({
        fen: makeFen(props.chess.toSetup()),
        movable: {
          dests: chessgroundDests(props.chess),
        },
      });
    }
  }

  function playMove(move: Move) {
    props.onMove(move);
  }

  createEffect(syncBoard);

  // React to a move being played on the board
  function onMove(fromStr: string, toStr: string) {
    const from = parseSquare(fromStr);
    const to = parseSquare(toStr);
    if (
      props.chess.board.get(from)?.role == "pawn" &&
      (squareRank(to) == 7 || squareRank(to) == 0)
    ) {
      // Pawn moved to the promotion square, set the pending promotion state so the user can pick
      // the piece
      setPendingPromotionState({ from, to, color: props.chess.turn });
    } else {
      playMove({ from, to });
    }
  }

  // Handle the user picking a promotion piece
  function onPromotionSelect(role: Role | null) {
    const pendingPromotion = pendingPromotionState();
    if (!pendingPromotion) {
      return;
    }
    if (role) {
      playMove({
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion: role,
      });
    } else {
      // Reset board state to before the move,
      syncBoard();
    }
    setPendingPromotionState(undefined);
  }

  // TODO: rank and file letters
  return (
    <div class="w-full h-full relative">
      <div
        class="w-full h-full"
        classList={{
          "opacity-50": pendingPromotionState() !== undefined,
        }}
        onWheel={(evt) => {
          if (evt.deltaY < 0) {
            props.onMoveForwards();
          } else {
            props.onMoveBackwards();
          }
        }}
        ref={ref}
      />
      <Show when={pendingPromotionState()}>
        {(state) => (
          <PromotionSelector onSelect={onPromotionSelect} {...state()} />
        )}
      </Show>
    </div>
  );
}
