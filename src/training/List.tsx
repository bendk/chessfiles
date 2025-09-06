import Plus from "lucide-solid/icons/plus";
import Loader from "lucide-solid/icons/loader-2";
import {
  Match,
  Switch,
  createEffect,
  createResource,
  createSignal,
} from "solid-js";
import type { MenuItem } from "~/components";
import {
  Button,
  Chooser,
  Dialog,
  Progress,
  Table,
  TableCell,
  TableMenuCell,
} from "~/components";
import { StatusError } from "~/lib/status";
import type { AppStorage } from "~/lib/storage";
import type { TrainingMeta } from "~/lib/training";
import { trainingTimeAgo } from "~/lib/training";
import { FileNotFoundError, TrainingExistsError } from "~/lib/storage";

export interface TrainingListProps {
  storage: AppStorage;
  openTraining: (meta: TrainingMeta) => Promise<void>;
  setChooserActive: (active: boolean) => void;
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
  }

  const [trainingMetas, { refetch: refetchTrainingMetas }] = createResource(
    () => props.storage.listTraining(),
  );

  createEffect(() => props.setChooserActive(showChooser()));

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
      props.storage.status.perform("opening training", async () => {
        await props.openTraining(meta);
      });
    } else if (action == "delete") {
      props.storage.status.perform("deleting training", async () => {
        await props.storage.removeTraining(meta);
        await refetchTrainingMetas();
      });
    } else if (action == "restart") {
      props.storage.status.perform("restarting training", async () => {
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
        await refetchTrainingMetas();
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
              props.storage.status.perform("creating training", async () => {
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
        <Match when={finishedMetaDialog()}>
          <Dialog
            onSubmit={restartFininshedMeta}
            onClose={() => setFinishedMetaDialog(null)}
            title="Training is finished"
            submitText="Restart Training"
          >
            <div>You've already finished this training</div>
          </Dialog>
        </Match>
        <Match when={true}>
          <div class="grow flex flex-col min-h-0 px-8 pt-4 pb-8">
            <div class="grow pt-4">
              <Switch>
                <Match when={trainingMetas.loading}>
                  <Loader class="animate-spin duration-1000" size={32} />
                </Match>
                <Match when={trainingMetas.error}>
                  <div class="text-2xl flex gap-2">
                    Error loading training data
                  </div>
                </Match>
                <Match
                  when={
                    trainingMetas.state == "ready" &&
                    trainingMetas().length == 0
                  }
                >
                  <h2 class="text-3xl">No active training sessions</h2>
                  <p class="text-lg pt-1">
                    Use the "Start Training" button below to start training.
                  </p>
                </Match>
                <Match when={trainingMetas.state == "ready"}>
                  <Table
                    each={trainingMetas() ?? []}
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
                          {trainingTimeAgo(item.value, currentTimestamp)}
                        </TableCell>
                        <TableMenuCell item={item} />
                      </>
                    )}
                  </Table>
                </Match>
              </Switch>
            </div>
            <div class="flex gap-8 pt-8">
              <Button
                text="New Training Session"
                icon=<Plus />
                onClick={() => setShowChooser(true)}
              />
            </div>
          </div>
        </Match>
      </Switch>
    </>
  );
}
