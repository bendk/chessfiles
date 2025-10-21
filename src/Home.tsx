import { Show, createResource } from "solid-js";
import Loader from "lucide-solid/icons/loader-2";
import { activityDescription, activityTimeAgo } from "~/lib/activity";
import type { AppStorage } from "~/lib/storage";
import type { TrainingMeta } from "~/lib/training";
import { trainingTimeAgo } from "~/lib/training";
import type { Page, StatusTracker } from "~/components";
import Database from "lucide-solid/icons/database";
import { Progress, StandardLayout, Table, TableCell } from "~/components";

export interface HomeProps {
  storage: AppStorage;
  status: StatusTracker;
  setPage: (page: Page) => void;
}

export function Home(props: HomeProps) {
  function openStorageEngine(name: string) {
    props.setPage({
      name: "files",
      initialPath: `/${name}`,
    });
  }

  const [trainingListing] = createResource(() => props.storage.listTraining());
  const [activityListing] = createResource(() => props.storage.listActivity());

  function openTraining(meta: TrainingMeta) {
    props.status.perform("opening training", async () => {
      const training = await props.storage.loadTraining(meta);
      props.setPage({
        name: "training",
        initialTraining: training,
      });
    });
  }

  const currentTimestamp = Date.now();

  return (
    <StandardLayout page="home" setPage={props.setPage}>
      <div class="flex gap-20 grow h-full pb-8">
        <div class="flex flex-col gap-12 grow">
          <div>
            <h2 class="text-2xl pb-2">Files</h2>
            <Table
              each={props.storage.toplevelStorageEngines()}
              columns={2}
              onClick={(entry) => openStorageEngine(entry)}
            >
              {(item) => (
                <>
                  <TableCell grow item={item} class="flex items-center gap-2">
                    <Database size={20} /> {item.value}
                  </TableCell>
                </>
              )}
            </Table>
          </div>
          <div class="grow min-h-0 flex flex-col">
            <h2 class="text-2xl pb-2">Training</h2>
            <div class="overflow-y-auto">
              <Show
                when={trainingListing()}
                fallback={
                  <Loader class="animate-spin duration-1000" size={32} />
                }
              >
                <Table
                  each={trainingListing()?.metas ?? []}
                  columns={4}
                  onClick={openTraining}
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
                    </>
                  )}
                </Table>
              </Show>
            </div>
          </div>
          <div>
            <h2 class="text-2xl">Connected accounts</h2>
          </div>
        </div>
        <div class="w-100">
          <h2 class="text-2xl pb-2">Activity</h2>
          <div class="overflow-y-auto">
            <Show
              when={activityListing()}
              fallback={<Loader class="animate-spin duration-1000" size={32} />}
            >
              <Table each={activityListing() ?? []} columns={2}>
                {(item) => (
                  <>
                    <TableCell grow item={item}>
                      {activityDescription(item.value)}
                    </TableCell>
                    <TableCell item={item}>
                      {activityTimeAgo(item.value.timestamp, currentTimestamp)}
                    </TableCell>
                  </>
                )}
              </Table>
            </Show>
          </div>
        </div>
      </div>
    </StandardLayout>
  );
}
