import Plus from "lucide-solid/icons/plus";
import Loader from "lucide-solid/icons/loader-2";
import IconSettings from "lucide-solid/icons/settings";
import {
  Match,
  Show,
  Switch,
  createEffect,
  createResource,
  createSignal,
} from "solid-js";
import type { AppControls, MenuItem, StatusTracker } from "~/components";
import {
  Button,
  Checkbox,
  Chooser,
  Dialog,
  Progress,
  RadioGroup,
  StandardLayout,
  StatusError,
  Table,
  TableCell,
  TableMenuCell,
} from "~/components";
import type { AppStorage } from "~/lib/storage";
import type { TrainingMeta, TrainingSettings } from "~/lib/training";
import { trainingTimeAgo } from "~/lib/training";
import { FileNotFoundError, TrainingExistsError } from "~/lib/storage";

export interface TrainingListProps {
  storage: AppStorage;
  status: StatusTracker;
  openTraining: (meta: TrainingMeta) => Promise<void>;
  controls: AppControls;
}

type DialogInfo =
  | { type: "finished"; meta: TrainingMeta }
  | { type: "settings" };

export function TrainingList(props: TrainingListProps) {
  const [showChooser, setShowChooser] = createSignal(false);
  const [chooserError, setChooserError] = createSignal<string | undefined>();
  const [trainingSettings, setTrainingSettings] =
    createSignal<TrainingSettings | null>(null);
  const [dialog, setDialog] = createSignal<DialogInfo | null>(null);

  async function restartFininshedMeta() {
    const d = dialog();
    if (d === null || d.type != "finished") {
      console.error("invalid dialog for restartFininshedMeta (${d})");
      return;
    }
    await onMenuAction(d.meta, "restart");
    setDialog(null);
    await onMenuAction(d.meta, "open");
  }

  const [trainingListing, { refetch: refetchTrainingListing }] = createResource(
    () => props.storage.listTraining(),
  );

  function menu(meta: TrainingMeta): MenuItem[] {
    return [
      {
        value: "open",
        text: "Open",
        disabled: meta.linesTrained >= meta.totalLines,
      },
      {
        value: "restart",
        text: "Restart",
      },
      {
        value: "delete",
        text: "Delete",
      },
    ];
  }

  async function onMenuAction(meta: TrainingMeta, action: string) {
    if (action == "open") {
      if (meta.linesTrained >= meta.totalLines) {
        setDialog({ type: "finished", meta });
        return;
      }
      props.status.perform("opening training", async () => {
        await props.openTraining(meta);
      });
    } else if (action == "delete") {
      props.status.perform("deleting training", async () => {
        await props.storage.removeTraining(meta);
        await refetchTrainingListing();
      });
    } else if (action == "restart") {
      await props.status.perform("restarting training", async () => {
        try {
          await props.storage.restartTraining(meta);
        } catch (e) {
          if (e instanceof FileNotFoundError) {
            throw new StatusError(
              "Book not found while restarting training.  Was it moved?",
            );
          }
          throw e;
        }
        await refetchTrainingListing();
      });
    }
  }

  const currentTimestamp = Date.now();

  createEffect(async () => {
    if (trainingSettings() === null) {
      setTrainingSettings(await props.storage.readTrainingSettings());
    }
  });

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
    <>
      <Switch>
        <Match when={showChooser()} keyed>
          <Chooser
            title="Select book to train"
            storage={props.storage.clone()}
            error={chooserError()}
            onSelect={async (path) => {
              props.status.perform("creating training", async () => {
                let training;
                try {
                  training = await props.storage.createTraining(path);
                } catch (e) {
                  if (e instanceof TrainingExistsError) {
                    setChooserError(
                      "Training already in progress for that book",
                    );
                    return;
                  }
                  setShowChooser(false);
                  throw e;
                }
                await props.openTraining(training.meta);
                setShowChooser(false);
              });
            }}
            onClose={() => {
              setChooserError(undefined);
              setShowChooser(false);
            }}
          />
        </Match>
        <Match when={true}>
          <StandardLayout page="training" controls={props.controls}>
            <Switch>
              <Match when={dialog()?.type == "finished"}>
                <Dialog
                  onSubmit={restartFininshedMeta}
                  onClose={() => setDialog(null)}
                  title="Training is finished"
                  submitText="Restart Training"
                >
                  <div>You've already finished this training</div>
                </Dialog>
              </Match>
              <Match when={dialog()?.type == "settings"}>
                <Dialog
                  onClose={() => setDialog(null)}
                  closeText="Close"
                  title="Training Settings"
                >
                  <Show when={trainingSettings()} keyed>
                    {(settings) => (
                      <div class="flex flex-col gap-4">
                        <Checkbox
                          label="Randomize lines"
                          checked={settings.shuffle}
                          onChange={updateTrainingShuffle}
                        />

                        <RadioGroup.Root
                          value={settings.skipAfter.toString()}
                          onValueChange={updateTrainingRetrainLimit}
                        >
                          <RadioGroup.Label
                            text="Retrain limit"
                            help="Skip moves after getting them correct this many times in a row"
                          />
                          <RadioGroup.Item text="2 moves" value="2" />
                          <RadioGroup.Item text="3 moves" value="3" />
                          <RadioGroup.Item text="4 moves" value="4" />
                          <RadioGroup.Item
                            text="Always retrain moves"
                            value="0"
                          />
                        </RadioGroup.Root>

                        <RadioGroup.Root
                          value={settings.moveDelay.toString()}
                          onValueChange={updateTrainingMoveDelay}
                        >
                          <RadioGroup.Label text="Opponent Move Delay" />
                          <RadioGroup.Item text="None" value="0" />
                          <RadioGroup.Item text="0.25 seconds" value="0.25" />
                          <RadioGroup.Item text="0.5 seconds" value="0.5" />
                          <RadioGroup.Item text="1 second" value="1" />
                        </RadioGroup.Root>
                      </div>
                    )}
                  </Show>
                </Dialog>
              </Match>
              <Match when={trainingListing.loading}>
                <Loader class="animate-spin duration-1000" size={32} />
              </Match>
              <Match when={trainingListing.error}>
                <div class="text-2xl flex gap-2">
                  Error loading training data
                </div>
              </Match>
              <Match when={trainingListing.state == "ready"}>
                <div class="flex items-start gap-8 w-full">
                  <div class="flex-1">
                    <h3 class="text-2xl text-left text-zinc-400 pb-4">
                      Sessions
                    </h3>
                    <Switch>
                      <Match when={trainingListing()?.metas.length == 0}>
                        <p class="text-lg pt-1">
                          Press "New Training Session" to start training.
                        </p>
                      </Match>
                      <Match when={true}>
                        <Table
                          each={trainingListing()?.metas ?? []}
                          columns={4}
                          onClick={(meta) => onMenuAction(meta, "open")}
                          menu={menu}
                          onMenuSelect={onMenuAction}
                          headers={["Name", "Progress", "Last trained", ""]}
                        >
                          {(item) => (
                            <>
                              <TableCell grow item={item}>
                                {item.value.name}
                              </TableCell>
                              <TableCell item={item}>
                                <Progress
                                  value={
                                    (100 * item.value.linesTrained) /
                                    item.value.totalLines
                                  }
                                />
                              </TableCell>
                              <TableCell item={item}>
                                {trainingTimeAgo(
                                  item.value.lastTrained,
                                  currentTimestamp,
                                )}
                              </TableCell>
                              <TableMenuCell item={item} />
                            </>
                          )}
                        </Table>
                      </Match>
                    </Switch>
                  </div>
                  <div class="flex-1">
                    <Show when={trainingListing()?.activity}>
                      <h3 class="text-2xl text-left text-zinc-400 pb-4">
                        Activity
                      </h3>
                      <Table
                        each={trainingListing()?.activity ?? []}
                        columns={4}
                        headers={[
                          "Name",
                          "Lines trained",
                          "Accuracy",
                          "Last trained",
                        ]}
                      >
                        {(item) => (
                          <>
                            <TableCell grow item={item}>
                              {item.value.name}
                            </TableCell>
                            <TableCell item={item}>
                              {item.value.linesTrained}
                            </TableCell>
                            <TableCell item={item}>
                              <Progress
                                value={
                                  (100 * item.value.correctCount) /
                                  (item.value.correctCount +
                                    item.value.incorrectCount)
                                }
                              />
                            </TableCell>
                            <TableCell item={item}>
                              {trainingTimeAgo(
                                item.value.timestamp,
                                currentTimestamp,
                              )}
                            </TableCell>
                          </>
                        )}
                      </Table>
                    </Show>
                  </div>
                </div>
                <div class="flex pt-16 gap-8">
                  <Button
                    text="Session"
                    icon=<Plus />
                    onClick={() => setShowChooser(true)}
                  />
                  <Button
                    text="Settings"
                    icon=<IconSettings />
                    onClick={() => setDialog({ type: "settings" })}
                  />
                </div>
              </Match>
            </Switch>
          </StandardLayout>
        </Match>
      </Switch>
    </>
  );
}
