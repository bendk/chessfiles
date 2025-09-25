import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { Piece } from "chessground/types";
import HandIcon from "lucide-solid/icons/hand";
import TrashIcon from "lucide-solid/icons/trash";
import { Button } from "~/components";
import { EMPTY_BOARD_FEN, INITIAL_FEN, parseFen, Chess } from "~/lib/chess";
import { createEffect, createSignal, onMount, Match, Switch } from "solid-js";

export interface SelectInitialPositionProps {
  name: string;
  onSelect: (fen: string) => void;
  onExit: () => void;
}

type Selection = Piece | "hand" | "trash";

export function SelectInitialPosition(props: SelectInitialPositionProps) {
  const [fen, setFen] = createSignal(INITIAL_FEN);
  const [selection, setSelection] = createSignal<Selection>("hand");
  const [api, setApi] = createSignal<Api | null>(null);

  const [submitEnabled, setSubmitEnabled] = createSignal(true);
  let ref!: HTMLDivElement;

  createEffect(() => {
    const setup = parseFen(fen());
    if (!setup.isOk) {
      setSubmitEnabled(false);
      return;
    }
    const chess = Chess.fromSetup(setup.unwrap());
    setSubmitEnabled(chess.isOk);
  });

  onMount(() => {
    const a = Chessground(ref, {
      coordinates: false,
      movable: { free: true },
      selectable: { enabled: false },
      events: {
        change: () => setFen(a.getFen()),
        select: (sq) => {
          const m = new Map();
          const s = selection();
          switch (s) {
            case "trash":
              m.set(sq, null);
              break;

            case "hand":
              return;

            default:
              m.set(sq, s);
              break;
          }
          a.setPieces(m);
          setFen(a.getFen());
        },
      },
      highlight: {
        lastMove: false,
      },
    });
    setApi(a);
  });
  return (
    <div class="flex flex-col w-200 m-auto pt-10">
      <div class="flex justify-between">
        <div class="text-3xl">Set initial position</div>
        <Button text="Exit" onClick={props.onExit} />
      </div>
      <div class="text-xl truncate text-ellipsis">{props.name}</div>
      <div class="flex mt-8 bg-white dark:bg-zinc-600 rounded-md">
        <BoardButton
          value="hand"
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
        <BoardButton
          value={{ color: "white", role: "king" }}
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
        <BoardButton
          value={{ color: "white", role: "queen" }}
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
        <BoardButton
          value={{ color: "white", role: "rook" }}
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
        <BoardButton
          value={{ color: "white", role: "knight" }}
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
        <BoardButton
          value={{ color: "white", role: "bishop" }}
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
        <BoardButton
          value={{ color: "white", role: "pawn" }}
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
        <BoardButton
          value="trash"
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
      </div>
      <div class="w-200 h-200 mt-2" ref={ref} />
      <div class="flex mt-2 bg-white dark:bg-zinc-600 rounded-md">
        <BoardButton
          value="hand"
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
        <BoardButton
          value={{ color: "black", role: "king" }}
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
        <BoardButton
          value={{ color: "black", role: "queen" }}
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
        <BoardButton
          value={{ color: "black", role: "rook" }}
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
        <BoardButton
          value={{ color: "black", role: "knight" }}
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
        <BoardButton
          value={{ color: "black", role: "bishop" }}
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
        <BoardButton
          value={{ color: "black", role: "pawn" }}
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
        <BoardButton
          value="trash"
          api={api()}
          selection={selection()}
          setSelection={setSelection}
        />
      </div>

      <div class="flex items-start justify-between w-full mt-8">
        <Button
          text="Set Initial Position"
          textSize="text-2xl"
          disabled={!submitEnabled()}
          onClick={() => props.onSelect(fen())}
        />
        <div class="flex gap-4">
          <Button
            text="Starting position"
            onClick={() => api()?.set({ fen: INITIAL_FEN })}
          />
          <Button
            text="Empty board"
            onClick={() => api()?.set({ fen: EMPTY_BOARD_FEN })}
          />
        </div>
      </div>
    </div>
  );
}

interface BoardButtonProps {
  value: Selection;
  api: Api | null;
  selection: Selection;
  setSelection: (selection: Selection) => void;
}

function BoardButton(props: BoardButtonProps) {
  const [readyToDrag, setReadyToDrag] = createSignal(false);
  return (
    <button
      class="cursor-pointer w-25 h-25 text-black flex items-center justify-center rounded-l-md"
      classList={{
        "hover:bg-sky-400 hover:dark:bg-sky-500":
          props.selection != props.value,
        "bg-zinc-400": props.selection == props.value,
      }}
      onClick={() => props.setSelection(props.value)}
      onDblClick={() => {
        if (props.value == "trash") {
          props.api?.set({ fen: EMPTY_BOARD_FEN });
        }
      }}
      onMouseDown={(evt) => {
        if (evt.button == 0) {
          setReadyToDrag(true);
        }
      }}
      onMouseUp={(evt) => {
        if (evt.button == 0) {
          setReadyToDrag(false);
        }
      }}
      onMouseMove={(evt) => {
        if (readyToDrag() && props.value != "hand" && props.value != "trash") {
          props.api?.dragNewPiece(props.value, evt);
          setReadyToDrag(false);
        }
      }}
    >
      <Switch>
        <Match when={props.value == "hand"}>
          <HandIcon size={50} />
        </Match>
        <Match when={props.value == "trash"}>
          <TrashIcon size={50} />
        </Match>
        <Match when={props.value as Piece} keyed>
          {(value) => (
            <div
              class={`piece-${value.role}-${value.color} w-20 h-20 bg-cover`}
            />
          )}
        </Match>
      </Switch>
    </button>
  );
}
