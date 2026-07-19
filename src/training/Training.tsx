import { Match, Switch, createEffect, createSignal } from "solid-js";
import type { AppStorage } from "~/lib/storage";
import type { Training as TrainingObj } from "~/lib/training";
import type { AppControls, StatusTracker } from "~/components";
import { TrainingList } from "./List";
import { TrainingSession } from "./Session";
import type { Book } from "~/lib/node";

export interface TrainingProps {
  storage: AppStorage;
  status: StatusTracker;
  controls: AppControls;
  initialTrainingPath?: string;
}

export function Training(props: TrainingProps) {
  const [trainingSessionData, setTrainingSessionData] = createSignal<
    [string, Book, TrainingObj] | null
  >(null);
  createSignal(async () => {
    if (props.initialTrainingPath !== undefined) {
      const [book, training] = await props.storage.loadBookAndTraining(
        props.initialTrainingPath,
      );
      setTrainingSessionData([props.initialTrainingPath, book, training]);
    }
  });

  // If we loaded a training session directly from home, then exited that session, go back to home
  createEffect(() => {
    if (
      props.initialTrainingPath !== undefined &&
      trainingSessionData() === null
    ) {
      props.controls.setPage({ name: "home" });
    }
  });

  return (
    <Switch>
      <Match when={trainingSessionData() === null}>
        <TrainingList
          storage={props.storage}
          status={props.status}
          openTraining={async (bookPath) => {
            const [book, training] =
              await props.storage.loadBookAndTraining(bookPath);
            setTrainingSessionData([bookPath, book, training]);
          }}
          controls={props.controls}
        />
      </Match>
      <Match when={trainingSessionData()} keyed>
        {([bookPath, book, training]) => (
          <TrainingSession
            storage={props.storage}
            status={props.status}
            book={book}
            bookPath={bookPath}
            training={training}
            controls={props.controls}
            onExit={() => setTrainingSessionData(null)}
          />
        )}
      </Match>
    </Switch>
  );
}
