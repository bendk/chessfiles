import CloudOff from "lucide-solid/icons/cloud-off";
import CloudCheck from "lucide-solid/icons/cloud-check";
import Loader from "lucide-solid/icons/loader-2";
import {
  Show,
  createMemo,
  createResource,
  createSignal,
  Match,
  Switch,
} from "solid-js";
import { activityDescription, activityTimeAgo } from "~/lib/activity";
import { dropbox, lichess } from "~/lib/auth";
import type { AppStorage } from "~/lib/storage";
import type { TrainingMeta } from "~/lib/training";
import { trainingTimeAgo } from "~/lib/training";
import type { StatusTracker, AppControls } from "~/components";
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
  controls: AppControls;
}

export function Home(props: HomeProps) {
  function openStorageEngine(name: string) {
    props.controls.setPage({
      name: "files",
      initialPath: `/${name}`,
    });
  }

  const [dialog, setDialog] = createSignal("");
  const [dropboxConnected, setDropboxConnected] = createSignal(
    dropbox.isAuthorized(),
  );
  const [lichessConnected, setLichessConnected] = createSignal(
    lichess.isAuthorized(),
  );
  const [trainingListing] = createResource(() => props.storage.listTraining());
  const [activityListing] = createResource(() => props.storage.listActivity());

  function openTraining(meta: TrainingMeta) {
    props.status.perform("opening training", async () => {
      const training = await props.storage.loadTraining(meta);
      props.controls.setPage({
        name: "training",
        initialTraining: training,
      });
    });
  }

  const trainingSection = createMemo(() => {
    const training = trainingListing();
    if (training === undefined) {
      return <Loader class="animate-spin duration-1000" size={32} />;
    } else if (training.metas.length == 0) {
      return <div class="italic">No training sessions in progress</div>;
    } else {
      return (
        <Table
          each={training.metas}
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
                    (100 * item.value.linesTrained) / item.value.totalLines
                  }
                />
              </TableCell>
              <TableCell item={item}>
                {trainingTimeAgo(item.value.lastTrained, currentTimestamp)}
              </TableCell>
            </>
          )}
        </Table>
      );
    }
  });

  const currentTimestamp = Date.now();
  return (
    <StandardLayout page="home" controls={props.controls}>
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
                <div class="flex items-center gap-1 text-success">
                  <CloudCheck /> Dropbox account connected
                </div>
              </Match>
              <Match when={!dropboxConnected()}>
                <div class="flex items-center gap-1 text-fg-2">
                  <CloudOff /> Dropbox account not connected
                </div>
              </Match>
            </Switch>
            <div class="pt-2">
              Connect your Dropbox account to provide storage space for your
              chess files.
            </div>
          </Dialog>
        </Match>
        <Match when={dialog() == "lichess"}>
          <Dialog
            title="Lichess Account"
            closeText="Close"
            onClose={() => setDialog("")}
            submitText={
              lichessConnected() ? "Disconnect Lichess" : "Connect Lichess"
            }
            onSubmit={async () => {
              if (lichessConnected()) {
                await lichess.disconnect();
                setLichessConnected(false);
                setDialog("");
              } else {
                lichess.startLogin();
              }
            }}
          >
            <Switch>
              <Match when={lichessConnected()}>
                <div class="flex items-center gap-1 text-success">
                  <CloudCheck /> Lichess account connected
                </div>
              </Match>
              <Match when={!lichessConnected()}>
                <div class="flex items-center gap-1 text-fg-2">
                  <CloudOff /> Lichess account not connected
                </div>
              </Match>
            </Switch>
            <div class="pt-2">
              Connect your Lichess account to get opening and endgame databases
              in the game editor.
            </div>
          </Dialog>
        </Match>
      </Switch>
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
            <div class="overflow-y-auto">{trainingSection()}</div>
          </div>
          <div class="flex gap-2 items-center">
            <h2 class="text-lg">Accounts:</h2>
            <div
              classList={{
                "text-success": dropboxConnected(),
                "text-fg-2": !dropboxConnected(),
              }}
            >
              <Button
                icon={dropboxConnected() ? <CloudCheck /> : <CloudOff />}
                text="Dropbox"
                style="flat"
                onClick={() => setDialog("dropbox")}
              />
            </div>
            <div class="flex items-start text-fg-2">
              <Button
                icon={lichessConnected() ? <CloudCheck /> : <CloudOff />}
                text="Lichess"
                style="flat"
                onClick={() => setDialog("lichess")}
              />
            </div>
          </div>
        </div>
        <div class="w-100">
          <h2 class="text-2xl pb-2">Activity</h2>
          <div class="overflow-y-auto">
            <Show
              when={activityListing()}
              fallback={<Loader class="animate-spin duration-1000" size={32} />}
            >
              <Table each={activityListing()?.slice(0, 20) ?? []} columns={2}>
                {(item) => (
                  <>
                    <TableCell grow class="text-md" item={item}>
                      {activityDescription(item.value)}
                    </TableCell>
                    <TableCell class="text-sm" item={item}>
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
