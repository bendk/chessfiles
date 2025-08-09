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
  Progress,
  Table,
  TableCell,
  TableMenuCell,
} from "~/components";
import type { AppStorage } from "~/lib/storage";
import type { TrainingMeta } from "~/lib/training";
import { trainingTimeAgo } from "~/lib/training";
import { TrainingExistsError } from "~/lib/storage";

export interface TrainingListProps {
  storage: AppStorage;
  openTraining: (meta: TrainingMeta) => void;
  setChooserActive: (active: boolean) => void;
}

export function TrainingList(props: TrainingListProps) {
  const [showChooser, setShowChooser] = createSignal(false);
  const [chooserError, setChooserError] = createSignal<string | undefined>();

  const [trainingMetas, { refetch: refetchTrainingMetas }] = createResource(
    () => props.storage.listTraining(),
  );

  createEffect(() => props.setChooserActive(showChooser()));

  function menu(): MenuItem[] {
    return [
      {
        value: "open",
        text: "Open",
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
      props.openTraining(meta);
    } else if (action == "delete") {
      props.storage.status.perform("deleting training", async () => {
        await props.storage.removeTraining(meta);
        await refetchTrainingMetas();
      });
    } else {
      console.log("action", meta, action);
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
              console.log("onSelect");
              props.storage.status.perform("creating training", async () => {
                try {
                  await props.storage.createTraining(path);
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
                await refetchTrainingMetas();
                setShowChooser(false);
              });
            }}
            onClose={() => {
              setChooserError(undefined);
              setShowChooser(false);
            }}
          />
        </Match>
        <Match when={!showChooser()}>
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
