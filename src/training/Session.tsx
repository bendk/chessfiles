import Pencil from "lucide-solid/icons/pencil";
import { Index, Show, createEffect, createMemo, createSignal } from "solid-js";
import { Board } from "~/editor/Board";
import { makeSanAndPlay } from "~/lib/chess";
import type { Move } from "~/lib/chess";
import type { AppStorage } from "~/lib/storage";
import type { Training } from "~/lib/training";
import { Button, MenuButton } from "~/components";

export interface TrainingSessionProps {
  storage: AppStorage;
  training: Training;
  onExit: () => void;
}

export function TrainingSession(props: TrainingSessionProps) {
  const [state, setState] = createSignal(props.training.state, {
    equals: false,
  });
  const [activity, setActivity] = createSignal(props.training.activity, {
    equals: false,
  });
  const [position, setPosition] = createSignal(props.training.board.position, {
    equals: false,
  });

  async function onExit() {
    props.storage.status.perform("saving training", async () => {
      await props.storage.updateTraining(props.training);
      props.onExit();
    });
  }

  createEffect(() => {
    const s = state();
    if (s.type == "advance-after-delay") {
      setTimeout(advance, 500);
    }
  });

  function update() {
    setState({ ...props.training.state });
    setActivity({ ...props.training.activity });
    setPosition(props.training.board.position);
    console.log(props.training.state);
  }

  function onMove(move: Move) {
    props.training.tryMove(move);
    update();
  }

  function advance() {
    props.training.advance();
    update();
  }

  function finishLine() {
    props.training.finishLine();
    update();
  }

  const adjustScoreButton = createMemo(() => {
    const s = state();
    if (s.type != "show-correct-move") {
      return null;
    }

    const items = [
      {
        text: "Correct",
        value: "correct",
        selected: s.score == "correct",
      },
      {
        text: "Incorrect",
        value: "incorrect",
        selected: s.score == "incorrect",
      },
      {
        text: "Skip",
        value: "skip",
        selected: s.score === null,
      },
    ];

    return (
      <MenuButton
        class="mb-4"
        style="full"
        text="adjust score"
        sameWidth
        placement="top"
        icon={<Pencil size={16} />}
        items={items}
        onSelect={updateLastScore}
      />
    );
  });

  function updateLastScore(adjustment: string) {
    if (adjustment == "correct" || adjustment == "incorrect") {
      props.training.updateLastScore(adjustment);
    } else {
      props.training.updateLastScore(null);
    }
    update();
  }

  const statePane = createMemo(() => {
    const s = state();
    switch (s.type) {
      case "choose-move": {
        return (
          <>
            <h2 class="text-2xl">Choose a move for {position().turn}</h2>
            <Show when={s.wrongMoves.length > 0}>
              <h2>
                Incorrect tries:
                <span class="ml-1 text-red-500">
                  <Index each={s.wrongMoves}>
                    {(move, index) =>
                      index != s.wrongMoves.length - 1 ? `${move()}, ` : move()
                    }
                  </Index>
                </span>
              </h2>
            </Show>
            <Button
              class="mt-1 w-full"
              text="Show Correct Move"
              onClick={advance}
            />
          </>
        );
      }

      case "show-correct-move": {
        return (
          <>
            <h2 class="text-2xl">Correct move: {s.correctMove}</h2>
            <Show when={s.wrongMoves.length > 0}>
              <h2>
                Incorrect tries:
                <span class="ml-1 text-red-500">
                  <Index each={s.wrongMoves}>
                    {(move, index) =>
                      index != s.wrongMoves.length - 1 ? `${move()}, ` : move()
                    }
                  </Index>
                </span>
              </h2>
            </Show>
            <Button class="mt-1 w-full" text="Continue" onClick={advance} />
          </>
        );
      }

      case "show-line-summary": {
        const pos = s.initialPosition.clone();
        return (
          <>
            <h2 class="text-2xl">Line complete</h2>
            <div>
              <Index each={s.line}>
                {(entry, ply) => {
                  const e = entry();
                  let prefix = "";
                  if (ply == 0) {
                    if (s.initialPosition.turn == "white") {
                      prefix = "1.";
                    } else {
                      prefix = "1\u2026";
                    }
                  } else {
                    if (s.initialPosition.turn == "black") {
                      ply += 1;
                    }
                    if (ply % 2 == 0) {
                      prefix = `${ply / 2 + 1}.`;
                    }
                  }
                  const san = makeSanAndPlay(pos, e.move);
                  const text = prefix + san;
                  if (e.score == "correct") {
                    return <span class="text-green-500">{text} </span>;
                  } else if (e.score == "incorrect") {
                    return <span class="text-red-500">{text} </span>;
                  } else {
                    return <span>{text} </span>;
                  }
                }}
              </Index>
            </div>
            <Button class="mt-1 w-full" text="Next line" onClick={finishLine} />
          </>
        );
      }

      case "show-training-summary": {
        return (
          <>
            <h2 class="text-2xl">Training complete</h2>
            <Button class="mt-1 w-full" text="Restart" onClick={finishLine} />
            <Button class="mt-1 w-full" text="Close" onClick={finishLine} />
          </>
        );
      }
    }
  });

  return (
    <div class="flex flex-col">
      <div class="flex justify-between pb-8">
        <h1 class="text-3xl truncate text-ellipsis">
          Training: {props.training.meta.name}
        </h1>
        <Button text="Exit" onClick={onExit} />
      </div>
      <div class="flex justify-center">
        <div class="flex gap-8">
          <div class="w-180 h-180">
            <Board chess={position()} onMove={onMove} enableShapes={false} />
          </div>
          <div class="flex flex-col w-80 justify-between">
            <div>{statePane()}</div>
            <div>
              {adjustScoreButton()}
              <h3 class="text-2xl">Moves this session</h3>
              <div class="flex justify-between">
                <span>Correct:</span>
                <span class="text-green-500">{activity().correctCount}</span>
              </div>
              <div class="flex justify-between">
                <span>Incorrect:</span>
                <span class="text-red-500">{activity().incorrectCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
