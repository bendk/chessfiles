import { Match, Switch, createEffect, createSignal } from "solid-js";
import type { AppStorage } from "~/lib/storage";
import type { TrainingMeta } from "~/lib/training";
import { TrainingList } from "./List";
import { TrainingSession } from "./Session";

export interface TrainingProps {
  storage: AppStorage;
  setNavbarShown: (shown: boolean) => void;
}

export function Training(props: TrainingProps) {
  const [currentTraining, setCurrentTraining] =
    createSignal<TrainingMeta | null>(null);
  createEffect(() => {
    props.setNavbarShown(currentTraining() === null);
  });

  return (
    <Switch>
      <Match when={currentTraining() === null}>
        <TrainingList
          storage={props.storage}
          openTraining={setCurrentTraining}
        />
      </Match>
      <Match when={currentTraining()} keyed>
        {(meta) => (
          <TrainingSession
            storage={props.storage}
            meta={meta}
            onExit={() => setCurrentTraining(null)}
          />
        )}
      </Match>
    </Switch>
  );
}
