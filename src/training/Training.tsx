import { Match, Switch, createSignal } from "solid-js";
import type { AppStorage } from "~/lib/storage";
import type { Training as TrainingObj } from "~/lib/training";
import type { StatusTracker } from "~/components";
import { TrainingList } from "./List";
import { TrainingSession } from "./Session";

export interface TrainingProps {
  storage: AppStorage;
  status: StatusTracker;
  setPage: (page: string) => void;
}

export function Training(props: TrainingProps) {
  const [currentTraining, setCurrentTraining] =
    createSignal<TrainingObj | null>(null);

  return (
    <Switch>
      <Match when={currentTraining() === null}>
        <TrainingList
          storage={props.storage}
          status={props.status}
          openTraining={async (meta) => {
            setCurrentTraining(await props.storage.loadTraining(meta));
          }}
          setPage={props.setPage}
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
