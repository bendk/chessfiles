import { createEffect, createSignal, Match, Show, Switch } from "solid-js";
import type { AppStorage, Storage } from "~/lib/storage";
import type { TrainingSettings } from "~/lib/training";
import * as settings from "~/lib/settings";
import * as dropbox from "~/lib/auth/dropbox";
import type { StatusTracker } from "~/components";
import {
  Button,
  Checkbox,
  Loader,
  RadioGroup,
  StandardLayout,
} from "~/components";
import { ImportPane } from "./ImportPane";

function removeHash() {
  history.pushState(
    "",
    document.title,
    window.location.pathname + window.location.search,
  );
}

export interface SettingsProps {
  storage: AppStorage;
  status: StatusTracker;
  setPage: (page: string) => void;
  theme: string;
  setTheme: (theme: string) => void;
}

export function Settings(props: SettingsProps) {
  const [importPane, setImportPane] = createSignal(false);
  const [trainingSettings, setTrainingSettings] =
    createSignal<TrainingSettings | null>(null);

  if (window.location.hash.startsWith("#settings-dropbox")) {
    settings.setStorage("dropbox");
    removeHash();
  }

  createEffect(async () => {
    if (trainingSettings() === null) {
      setTrainingSettings(await props.storage.readTrainingSettings());
    }
  });

  function changeStorage(storage: Storage) {
    settings.setStorage(storage);
    setTrainingSettings(null);
  }

  function onStorageClick(value: string | null) {
    if (settings.storage() == value) {
      return;
    }

    if (value == "browser") {
      changeStorage("browser");
    } else if (value == "dropbox") {
      if (dropbox.isAuthorized()) {
        changeStorage("dropbox");
      } else {
        dropbox.startLogin();
      }
    }
  }

  function updateTrainingSettings(settings: TrainingSettings) {
    props.storage.saveTrainingSettings(settings);
    setTrainingSettings(settings);
  }

  function updateTrainingShuffle(shuffle: boolean | null) {
    const current = trainingSettings();
    if (shuffle === null || current === null) {
      return;
    }
    updateTrainingSettings({
      ...current,
      shuffle,
    });
  }

  function updateTrainingRetrainLimit(value: string | null) {
    const current = trainingSettings();
    if (value === null || current === null) {
      return;
    }
    const skipAfter = Number.parseInt(value, 10);
    if (isNaN(skipAfter)) {
      return;
    }
    updateTrainingSettings({
      ...current,
      skipAfter,
    });
  }

  function updateTrainingMoveDelay(value: string | null) {
    const current = trainingSettings();
    if (value === null || current === null) {
      return;
    }
    const moveDelay = Number.parseFloat(value);
    if (isNaN(moveDelay)) {
      return;
    }
    updateTrainingSettings({
      ...current,
      moveDelay,
    });
  }

  return (
    <Show when={trainingSettings()} fallback={<Loader />}>
      {(trainingSettings) => (
        <Switch>
          <Match when={importPane()}>
            <ImportPane
              storage={props.storage}
              onClose={() => setImportPane(false)}
            />
          </Match>
          <Match when={!importPane()}>
            <StandardLayout page="settings" setPage={props.setPage}>
              <div class="min-w-200 mx-auto flex flex-col text-lg py-4 gap-8">
                <div>
                  <div class="text-3xl text-zinc-400 dark:text-zinc-400 border-b-1 border-zinc-400 dark:border-zinc-600 mb-2">
                    Theme
                  </div>
                  <div>
                    <RadioGroup.Root
                      value={props.theme}
                      onValueChange={(value) =>
                        value ? props.setTheme(value) : null
                      }
                    >
                      <RadioGroup.Item text="Light" value="light" />
                      <RadioGroup.Item text="Dark" value="dark" />
                    </RadioGroup.Root>
                  </div>
                </div>

                <div>
                  <div class="text-3xl text-zinc-400 dark:text-zinc-400 border-b-1 border-zinc-400 dark:border-zinc-600 mb-2">
                    Library
                  </div>
                  <div>
                    <RadioGroup.Root
                      value={settings.storage()}
                      onValueChange={(value) => onStorageClick(value)}
                    >
                      <RadioGroup.Label text="Storage" />
                      <RadioGroup.Item text="Browser" value="browser" />
                      <RadioGroup.Item text="Dropbox" value="dropbox" />
                    </RadioGroup.Root>
                  </div>

                  <div>
                    <div class="pt-8">
                      <Button
                        text="Import data from other storage"
                        onClick={() => setImportPane(true)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div class="text-3xl text-zinc-400 dark:text-zinc-400 border-b-1 border-zinc-400 dark:border-zinc-600 mb-2">
                    Editor
                  </div>
                  <RadioGroup.Root
                    value=""
                    onValueChange={(value) => onStorageClick(value)}
                  >
                    <RadioGroup.Label text="Engine" />
                    <RadioGroup.Item text="None" value="" />
                    <RadioGroup.Item
                      text="Stockfish"
                      value="stockfish"
                      disabled
                    />
                  </RadioGroup.Root>

                  <RadioGroup.Root
                    class="pt-4"
                    value=""
                    onValueChange={(value) => onStorageClick(value)}
                  >
                    <RadioGroup.Label text="Opening Book" />
                    <RadioGroup.Item text="None" value="" />
                    <RadioGroup.Item text="Lichess" value="lichess" disabled />
                  </RadioGroup.Root>

                  <RadioGroup.Root
                    class="pt-4"
                    value=""
                    onValueChange={(value) => onStorageClick(value)}
                  >
                    <RadioGroup.Label text="Endgame Tablebase" />
                    <RadioGroup.Item text="None" value="" />
                    <RadioGroup.Item text="Lichess" value="lichess" disabled />
                  </RadioGroup.Root>
                </div>

                <div>
                  <div class="text-3xl text-zinc-400 dark:text-zinc-400 border-b-1 border-zinc-400 dark:border-zinc-600 mb-2">
                    Training
                  </div>
                  <div class="flex flex-col gap-4">
                    <Checkbox
                      label="Randomize lines"
                      checked={trainingSettings().shuffle}
                      onChange={updateTrainingShuffle}
                    />

                    <RadioGroup.Root
                      value={trainingSettings().skipAfter.toString()}
                      onValueChange={updateTrainingRetrainLimit}
                    >
                      <RadioGroup.Label
                        text="Retrain limit"
                        help="Skip moves after getting them correct this many times in a row"
                      />
                      <RadioGroup.Item text="2 moves" value="2" />
                      <RadioGroup.Item text="3 moves" value="3" />
                      <RadioGroup.Item text="4 moves" value="4" />
                      <RadioGroup.Item text="Always retrain moves" value="0" />
                    </RadioGroup.Root>

                    <RadioGroup.Root
                      value={trainingSettings().moveDelay.toString()}
                      onValueChange={updateTrainingMoveDelay}
                    >
                      <RadioGroup.Label text="Opponent Move Delay" />
                      <RadioGroup.Item text="None" value="0" />
                      <RadioGroup.Item text="0.25 seconds" value="0.25" />
                      <RadioGroup.Item text="0.5 seconds" value="0.5" />
                      <RadioGroup.Item text="1 second" value="1" />
                    </RadioGroup.Root>
                  </div>
                </div>
              </div>
            </StandardLayout>
          </Match>
        </Switch>
      )}
    </Show>
  );
}
