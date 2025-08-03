import {
  chessgroundDests,
  makeFen,
  makeSquare,
  parseSquare,
  squareFile,
  squareRank,
} from "~/lib/chess";
import type { Move, Role, Chess, Shape, ShapeColor } from "~/lib/chess";
import type { DrawShape } from "chessground/draw";
import type { Api as ChessgroundApi } from "chessground/api";
import type { Key } from "chessground/types";
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
  shapes?: readonly Shape[];
  enableShapes?: boolean;
  toggleShape?: (shape: Shape) => void;
  onMoveBackwards?: () => void;
  onMoveForwards?: () => void;
}

interface PendingPromotionState {
  color: "white" | "black";
  from: number;
  to: number;
}

export function Board(props: BoardProps) {
  let ref!: HTMLDivElement;
  let board: ChessgroundApi | undefined;
  const [shapeFromSquare, setShapeFromSquare] = createSignal<Key | undefined>(
    undefined,
    {
      equals: (left, right) => left == right,
    },
  );
  const [pendingShape, setPendingShape] = createSignal<DrawShape | undefined>(
    undefined,
    {
      equals: (left, right) =>
        left?.orig == right?.orig &&
        left?.dest == right?.dest &&
        left?.brush == right?.brush,
    },
  );
  const [pendingPromotionState, setPendingPromotionState] =
    createSignal<PendingPromotionState>();

  // Make the board match the current `props.chess` value.  This is how we initialize the board and
  // react to changes to `props.chess`.
  function syncPosition() {
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
        drawable: {
          eraseOnClick: false,
          enabled: false,
          visible: true,
        },
      });
    }
    board.set({
      fen: makeFen(props.chess.toSetup()),
      movable: {
        dests: chessgroundDests(props.chess),
      },
    });
  }

  function playMove(move: Move) {
    props.onMove(move);
  }

  function syncShapes() {
    if (!board || props.shapes === undefined) {
      return;
    }
    const shapes: DrawShape[] = props.shapes.map((shape) => {
      if (shape.from == shape.to) {
        return {
          orig: makeSquare(shape.from),
          brush: shape.color,
        };
      } else {
        return {
          orig: makeSquare(shape.from),
          dest: makeSquare(shape.to),
          brush: shape.color,
        };
      }
    });
    const pending = pendingShape();
    if (pending) {
      shapes.push(pending);
    }
    board.setShapes(shapes);
  }

  createEffect(syncPosition);
  createEffect(syncShapes);

  function addPendingShape() {
    const shape = pendingShape();
    if (!shape || !props.toggleShape) {
      return;
    }
    if (shape.dest) {
      props.toggleShape({
        from: parseSquare(shape.orig),
        to: parseSquare(shape.dest),
        color: (shape.brush ?? "green") as ShapeColor,
      });
    } else {
      const square = parseSquare(shape.orig);
      props.toggleShape({
        from: square,
        to: square,
        color: (shape.brush ?? "green") as ShapeColor,
      });
    }
    setPendingShape(undefined);
  }

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
      syncPosition();
    }
    setPendingPromotionState(undefined);
  }

  return (
    <div class="w-full h-full relative">
      <div
        class="w-full h-full"
        classList={{
          "opacity-50": pendingPromotionState() !== undefined,
        }}
        on:contextmenu={(evt) => {
          evt.preventDefault();
          evt.stopPropagation();
        }}
        onMouseDown={(evt) => {
          if (board && evt.button == 2) {
            if (!props.enableShapes) {
              return;
            }
            const from = board.getKeyAtDomPos([evt.clientX, evt.clientY]);
            if (from) {
              setShapeFromSquare(from);
              setPendingShape({
                orig: from,
                dest: from,
                brush: "green",
              });
              return false;
            }
          }
        }}
        onMouseMove={(evt) => {
          const from = shapeFromSquare();
          if (board && from) {
            const to = board.getKeyAtDomPos([evt.clientX, evt.clientY]);
            if (to) {
              setPendingShape({
                orig: from,
                dest: to,
                brush: "green",
              });
            }
          }
        }}
        onMouseUp={(evt) => {
          setShapeFromSquare(undefined);
          if (evt.button == 2) {
            addPendingShape();
          } else {
            syncShapes();
          }
        }}
        onWheel={(evt) => {
          if (evt.deltaY < 0 && props.onMoveForwards) {
            props.onMoveForwards();
          } else if (evt.deltaY > 0 && props.onMoveBackwards) {
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
