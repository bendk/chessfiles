import CloudOff from "lucide-solid/icons/cloud-off";
import CloudCheck from "lucide-solid/icons/cloud-check";
import Loader from "lucide-solid/icons/loader-2";
import { Show, createResource, createSignal, Match, Switch } from "solid-js";
import { activityDescription, activityTimeAgo } from "~/lib/activity";
import * as dropbox from "~/lib/auth/dropbox";
import type { AppStorage } from "~/lib/storage";
import type { TrainingMeta } from "~/lib/training";
import { trainingTimeAgo } from "~/lib/training";
import type { Page, StatusTracker } from "~/components";
import Database from "lucide-solid/icons/database";
import {
  Button,
  Dialog,
  Progress,
  StandardLayout,
  Table,
  TableCell,
} from "~/components";

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

  const [dialog, setDialog] = createSignal("");
  const [dropboxConnected, setDropboxConnected] = createSignal(
    dropbox.isAuthorized(),
  );
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
    <Switch>
      <Match when={dialog() == "dropbox"}>
        <Dialog
          title="Dropbox Account"
          closeText="Close"
          onClose={() => setDialog("")}
          submitText={
            dropboxConnected() ? "Disconnect Dropbox" : "Connect Dropbox"
          }
          onSubmit={async () => {
            if (dropboxConnected()) {
              await dropbox.disconnect();
              setDropboxConnected(false);
              setDialog("");
            } else {
              dropbox.startLogin();
            }
          }}
        >
          <Switch>
            <Match when={dropboxConnected()}>
              <div class="flex items-center gap-1 text-green-500">
                <CloudCheck /> Dropbox account connected
              </div>
            </Match>
            <Match when={!dropboxConnected()}>
              <div class="flex items-center gap-1 text-zinc-500">
                <CloudOff /> Dropbox account not connected
              </div>
            </Match>
          </Switch>
          <div class="pt-2">
            Connected Dropbox accounts provide storage space for your chess
            files.
          </div>
        </Dialog>
      </Match>
      <Match when={true}>
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
                      <TableCell
                        grow
                        item={item}
                        class="flex items-center gap-2"
                      >
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
              <div class="flex gap-2 items-center">
                <h2 class="text-lg">Accounts:</h2>
                <div
                  classList={{
                    "text-green-500": dropboxConnected(),
                    "text-zinc-500": !dropboxConnected(),
                  }}
                >
                  <Button
                    icon={dropboxConnected() ? <CloudCheck /> : <CloudOff />}
                    text="Dropbox"
                    style="flat"
                    onClick={() => setDialog("dropbox")}
                  />
                </div>
                <div class="flex items-start text-zinc-500">
                  <Button icon={<CloudOff />} text="Lichess" style="flat" />
                </div>
              </div>
            </div>
            <div class="w-100">
              <h2 class="text-2xl pb-2">Activity</h2>
              <div class="overflow-y-auto">
                <Show
                  when={activityListing()}
                  fallback={
                    <Loader class="animate-spin duration-1000" size={32} />
                  }
                >
                  <Table each={activityListing() ?? []} columns={2}>
                    {(item) => (
                      <>
                        <TableCell grow item={item}>
                          {activityDescription(item.value)}
                        </TableCell>
                        <TableCell item={item}>
                          {activityTimeAgo(
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
          </div>
        </StandardLayout>
      </Match>
    </Switch>
  );
}
