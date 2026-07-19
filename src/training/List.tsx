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
  menuItem,
  Button,
  Checkbox,
  ChooserDialog,
  Dialog,
  Progress,
  RadioGroup,
  StandardLayout,
  StatusError,
  Table,
  TableCell,
  TableMenuCell,
} from "~/components";
import type { AppStorage, TrainingMetaWithPath } from "~/lib/storage";
import type { TrainingMeta, TrainingSettings } from "~/lib/training";
import { trainingTimeAgo } from "~/lib/training";
import { filename, FileNotFoundError } from "../lib/storage/";
import { TrainingRankIcon } from "./Rank.tsx";

export interface TrainingListProps {
  storage: AppStorage;
  status: StatusTracker;
  openTraining: (bookPath: string) => Promise<void>;
  controls: AppControls;
}

type DialogInfo =
  | { type: "finished"; meta: TrainingMetaWithPath }
  | { type: "new-session" }
  | { type: "settings" };

export function TrainingList(props: TrainingListProps) {
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
    await props.storage.restartTraining(d.meta.bookPath);
    await props.openTraining(d.meta.bookPath);
    setDialog(null);
    refetchTrainingListing();
  }

  const [trainingListing, { refetch: refetchTrainingListing }] = createResource(
    () => props.storage.listTraining(),
  );

  function menu(meta: TrainingMeta): MenuItem[] {
    return [
      menuItem("open", "Open", {
        disabled: meta.linesTrained >= meta.totalLines,
      }),
      menuItem("restart", "Restart"),
      menuItem("delete", "Delete"),
    ];
  }

  async function onMenuAction(meta: TrainingMetaWithPath, action: string) {
    if (action == "open") {
      if (meta.linesTrained >= meta.totalLines) {
        setDialog({ type: "finished", meta });
        return;
      }
      props.status.perform("opening training", async () => {
        await props.openTraining(meta.bookPath);
      });
    } else if (action == "delete") {
      props.status.perform("deleting training", async () => {
        await props.storage.removeTraining(meta.bookPath);
        await refetchTrainingListing();
      });
    } else if (action == "restart") {
      await props.status.perform("restarting training", async () => {
        try {
          await props.storage.restartTraining(meta.bookPath);
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
    <StandardLayout page="training" controls={props.controls}>
      <Switch>
        <Match when={dialog()?.type == "new-session"} keyed>
          <ChooserDialog
            title="Select book to train"
            storage={props.storage.clone()}
            error={chooserError()}
            onSelect={async (path) => {
              props.status.perform("creating training", async () => {
                const book = await props.storage.readBook(path);
                if (!book.hasTraining()) {
                  setChooserError(
                    `${filename(path)} does not contain a training game`,
                  );
                  return;
                }
                if (book.hasTrainingSession()) {
                  setChooserError("Training already in progress for that book");
                  return;
                }
                await props.openTraining(path);
                setDialog(null);
              });
            }}
            onClose={() => {
              setChooserError(undefined);
              setDialog(null);
            }}
          />
        </Match>

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
                    <RadioGroup.Item text="Always retrain moves" value="0" />
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
          <div class="text-2xl flex gap-2">Error loading training data</div>
        </Match>
        <Match when={trainingListing.state == "ready"}>
          <div class="h-full flex items-start gap-8 w-full">
            <div class="flex-1">
              <div class="flex justify-between">
                <h3 class="text-2xl text-left text-fg-2 pb-4">Sessions</h3>
                <Button
                  textSize="text-base"
                  style="flat"
                  icon=<IconSettings />
                  onClick={() => setDialog({ type: "settings" })}
                />
              </div>
              <Switch>
                <Match when={trainingListing()?.metas.length == 0}>
                  <p class="text-lg italic">No sessions in progress.</p>
                </Match>
                <Match when={true}>
                  <Table
                    each={trainingListing()?.metas ?? []}
                    columns={5}
                    onClick={(meta) => onMenuAction(meta, "open")}
                    menu={menu}
                    onMenuSelect={onMenuAction}
                    headers={["Name", "Rank", "Progress", "Last trained", ""]}
                  >
                    {(item) => (
                      <>
                        <TableCell grow item={item}>
                          {item.value.name}
                        </TableCell>
                        <TableCell item={item}>
                          <TrainingRankIcon rank={item.value.rank} />
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
              <Button
                text="New Session"
                class="mt-4"
                icon=<Plus />
                onClick={() => setDialog({ type: "new-session" })}
              />
            </div>
            <div class="flex-1">
              <Show when={trainingListing()?.activity}>
                <h3 class="text-2xl text-left text-fg-2 pb-4">Activity</h3>
                <Table
                  each={trainingListing()?.activity?.slice(0, 20) ?? []}
                  columns={4}
                  headers={["Name", "Lines trained", "Accuracy", "When"]}
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
        </Match>
      </Switch>
    </StandardLayout>
  );
}
