import Plus from "lucide-solid/icons/plus";
import Loader from "lucide-solid/icons/loader-2";
import {
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
  useContext,
} from "solid-js";
import type { MenuItem } from "~/components";
import {
  AppContext,
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
}

export function TrainingList(props: TrainingListProps) {
  const context = useContext(AppContext);
  const [dialog, setDialog] = createSignal(false);
  const [dialogError, setDialogError] = createSignal<string | undefined>();

  const [trainingMetas, { refetch: refetchTrainingMetas }] = createResource(
    () => props.storage.listTraining(),
  );

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
      context.perform("deleting training", async () => {
        await props.storage.removeTraining(meta);
        await refetchTrainingMetas();
      });
    } else {
      console.log("action", meta, action);
    }
  }

  function closeDialog() {
    setDialog(false);
    setDialogError(undefined);
  }

  const currentTimestamp = Date.now();

  return (
    <>
      <div class="grow flex flex-col min-h-0 px-8 pt-4 pb-8">
        <div class="grow pt-4">
          <Switch>
            <Match when={trainingMetas.loading}>
              <Loader class="animate-spin duration-1000" size={32} />
            </Match>
            <Match when={trainingMetas.error}>
              <div class="text-2xl flex gap-2">Error loading training data</div>
            </Match>
            <Match
              when={
                trainingMetas.state == "ready" && trainingMetas().length == 0
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
        <div class="flex gap-8">
          <Button
            text="New Training Session"
            icon=<Plus />
            onClick={() => setDialog(true)}
          />
        </div>
      </div>
      <Show when={dialog()}>
        <Chooser
          title="Select book to train"
          error={dialogError()}
          onSelect={async (path) => {
            context.perform("creating training", async () => {
              try {
                await props.storage.createTraining(path);
              } catch (e) {
                if (e instanceof TrainingExistsError) {
                  setDialogError("Training already in progress for that book");
                  return;
                }
                closeDialog();
                throw e;
              }
              await refetchTrainingMetas();
              closeDialog();
            });
          }}
          onClose={closeDialog}
        />
      </Show>
    </>
  );
}
