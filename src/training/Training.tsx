import { Match, Switch, createSignal } from "solid-js";
import type { AppStorage } from "~/lib/storage";
import type { Training as TrainingObj } from "~/lib/training";
import { Layout } from "~/components";
import { TrainingList } from "./List";
import { TrainingSession } from "./Session";

export interface TrainingProps {
  storage: AppStorage;
}

export function Training(props: TrainingProps) {
  const [currentTraining, setCurrentTraining] =
    createSignal<TrainingObj | null>(null);
  const [chooserActive, setChooserActive] = createSignal(false);

  return (
    <Layout
      navbar={currentTraining() === null && !chooserActive()}
      status={props.storage.status}
    >
      <Switch>
        <Match when={currentTraining() === null}>
          <TrainingList
            storage={props.storage}
            openTraining={async (meta) => {
              setCurrentTraining(await props.storage.loadTraining(meta));
            }}
            setChooserActive={setChooserActive}
          />
        </Match>
        <Match when={currentTraining()} keyed>
          {(training) => (
            <TrainingSession
              storage={props.storage}
              training={training}
              onExit={() => setCurrentTraining(null)}
            />
          )}
        </Match>
      </Switch>
    </Layout>
  );
}
