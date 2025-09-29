import Plus from "lucide-solid/icons/plus";
import Loader from "lucide-solid/icons/loader-2";
import { Match, Show, Switch, createResource, createSignal } from "solid-js";
import type { MenuItem, StatusTracker } from "~/components";
import {
  Button,
  Chooser,
  Dialog,
  Progress,
  StandardLayout,
  StatusError,
  Table,
  TableCell,
  TableMenuCell,
} from "~/components";
import type { AppStorage } from "~/lib/storage";
import type { TrainingMeta } from "~/lib/training";
import { trainingTimeAgo } from "~/lib/training";
import { FileNotFoundError, TrainingExistsError } from "~/lib/storage";

export interface TrainingListProps {
  storage: AppStorage;
  status: StatusTracker;
  openTraining: (meta: TrainingMeta) => Promise<void>;
  setPage: (page: string) => void;
}

export function TrainingList(props: TrainingListProps) {
  const [showChooser, setShowChooser] = createSignal(false);
  const [chooserError, setChooserError] = createSignal<string | undefined>();

  const [finishedMetaDialog, setFinishedMetaDialog] =
    createSignal<TrainingMeta | null>(null);
  async function restartFininshedMeta() {
    const meta = finishedMetaDialog();
    if (meta === null) {
      console.log("restartFininshedMeta with null meta");
      return;
    }
    await onMenuAction(meta, "restart");
    setFinishedMetaDialog(null);
    await onMenuAction(meta, "open");
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
        setFinishedMetaDialog(meta);
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
          <StandardLayout page="training" setPage={props.setPage}>
            <Show when={finishedMetaDialog()}>
              <Dialog
                onSubmit={restartFininshedMeta}
                onClose={() => setFinishedMetaDialog(null)}
                title="Training is finished"
                submitText="Restart Training"
              >
                <div>You've already finished this training</div>
              </Dialog>
            </Show>
            <Switch>
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
                    <div class="flex pt-8">
                      <Button
                        text="New Training Session"
                        icon=<Plus />
                        onClick={() => setShowChooser(true)}
                      />
                    </div>
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
              </Match>
            </Switch>
          </StandardLayout>
        </Match>
      </Switch>
    </>
  );
}
