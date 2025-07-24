import {
  Index,
  Match,
  Show,
  Switch,
  createMemo,
  createSignal,
  createResource,
} from "solid-js";
import { Board } from "~/editor/Board";
import type { Move } from "~/lib/chess";
import type { AppStorage } from "~/lib/storage";
import type { Training } from "~/lib/training";
import type { TrainingMeta } from "~/lib/training";
import { Button, Loader } from "~/components";

export interface TrainingSessionProps {
  storage: AppStorage;
  meta: TrainingMeta;
  onExit: () => void;
}

export function TrainingSession(props: TrainingSessionProps) {
  const [training] = createResource(() =>
    props.storage.loadTraining(props.meta),
  );

  return (
    <div class="grow flex flex-col min-h-0 px-8 pt-4 pb-8">
      <Switch>
        <Match when={training.loading}>
          <Loader />
        </Match>
        <Match when={training.error}>
          <div class="text-2xl flex gap-2">Error loading training session</div>
        </Match>
        <Match when={training()} keyed>
          {(training) => (
            <TrainingSessionInner training={training} onExit={props.onExit} />
          )}
        </Match>
      </Switch>
    </div>
  );
}

export interface TrainingSessionInnerProps {
  training: Training;
  onExit: () => void;
}

function TrainingSessionInner(props: TrainingSessionInnerProps) {
  const [state, setState] = createSignal(props.training.state, {
    equals: false,
  });
  const [activity, setActivity] = createSignal(props.training.activity, {
    equals: false,
  });
  const [position, setPosition] = createSignal(props.training.board.position, {
    equals: false,
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

  function updateLastScore(adjustment: "correct" | "incorrect" | null) {
    props.training.updateLastScore(adjustment);
    update();
  }

  const statePane = createMemo(() => {
    const s = state();
    switch (s.type) {
      case "choose-move":
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

      case "show-correct-move":
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

            <Show when={s.wrongMoves.length > 0}>
              <div class="pt-24">Was your move just as good?</div>
              <Button
                class="mt-1 w-full"
                text="Grant full credit"
                onClick={() => updateLastScore("correct")}
              />
            </Show>
          </>
        );

      case "show-line-summary":
        return <>show-line-summary</>;

      case "show-training-summary":
        return <>show-training-summary</>;
    }
  });

  return (
    <div class="flex flex-col">
      <div class="flex justify-between pb-8">
        <h1 class="text-3xl">Training: {props.training.meta.name}</h1>
        <Button text="Exit" onClick={props.onExit} />
      </div>
      <div class="flex justify-center">
        <div class="flex gap-8">
          <div class="w-180 h-180">
            <Board chess={position()} onMove={onMove} enableShapes={false} />
          </div>
          <div class="flex flex-col w-80 justify-between">
            <div>{statePane()}</div>
            <div>
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
