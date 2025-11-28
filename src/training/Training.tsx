import { Match, Switch, createEffect, createSignal } from "solid-js";
import type { AppStorage } from "~/lib/storage";
import type { Training as TrainingObj } from "~/lib/training";
import type { AppControls, StatusTracker } from "~/components";
import { TrainingList } from "./List";
import { TrainingSession } from "./Session";

export interface TrainingProps {
  storage: AppStorage;
  status: StatusTracker;
  controls: AppControls;
  initialTraining?: TrainingObj;
}

export function Training(props: TrainingProps) {
  const [currentTraining, setCurrentTraining] =
    createSignal<TrainingObj | null>(props.initialTraining ?? null);

  // If we loaded a training session directly from home, then exited that session, go back to home
  createEffect(() => {
    if (props.initialTraining !== undefined && currentTraining() === null) {
      props.controls.setPage({ name: "home" });
    }
  });

  return (
    <Switch>
      <Match when={currentTraining() === null}>
        <TrainingList
          storage={props.storage}
          status={props.status}
          openTraining={async (meta) => {
            setCurrentTraining(await props.storage.loadTraining(meta));
          }}
          controls={props.controls}
        />
      </Match>
      <Match when={currentTraining()} keyed>
        {(training) => (
          <TrainingSession
            storage={props.storage}
            status={props.status}
            training={training}
            onExit={() => setCurrentTraining(null)}
          />
        )}
      </Match>
    </Switch>
  );
}
