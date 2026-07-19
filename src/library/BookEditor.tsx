import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  Match,
  Show,
  Switch,
} from "solid-js";
import type { Book } from "~/lib/node";
import { RootNode, RootNodeType } from "~/lib/node";
import { type AppStorage } from "~/lib/storage";
import { Editor } from "../editor";
import type { AppControls, MenuItem, StatusTracker } from "../components";
import {
  menuItem,
  Button,
  ChooserDialog,
  Dialog,
  Loader,
  Table,
  TableCell,
  TableGripperCell,
  TableMenuCell,
  TrainingRankIcon,
  MenuButton,
} from "../components";
import type { TrainingMeta } from "~/lib/training";
import {
  lastTrainedTimeDisplay,
  nextRankAvailableTimeDisplay,
  TrainingRank,
} from "~/lib/training";

export interface BookEditorProps {
  book: Book;
  storage: AppStorage;
  controls: AppControls;
  filename: string;
  onExit: () => void;
  status: StatusTracker;
}

type DialogInfo =
  | {
      type: "confirm-delete";
      rootNode: RootNode;
    }
  | {
      type: "move";
      rootNode: RootNode;
    }
  | {
      type: "copy";
      rootNode: RootNode;
    }
  | {
      type: "edit-training";
    };

export function BookEditor(props: BookEditorProps) {
  const [reorderCounter, setReorderCounter] = createSignal(0);
  const [dialogInfo, setDialogInfo] = createSignal<DialogInfo | null>(null);
  const [trainingMeta, { mutate: mutateTrainingMeta }] = createResource(
    async () => {
      return (await props.storage.loadTraining(props.filename)).meta;
    },
  );

  const [currentRootNode, setCurrentRootNode] = createSignal<RootNode | null>(
    null,
  );
  function rootNodes() {
    // load the reorder counter so that this refreshes when it's incremented
    reorderCounter();
    return props.book.rootNodes;
  }

  function findRootNodeIndex(id: string): number {
    const index = props.book.rootNodes.findIndex((n) => n.id == id);
    if (index == -1) {
      console.error("rootNode index missing", props.book.rootNodes, id);
      throw Error("Game not found");
    }
    return index;
  }

  function menu(): MenuItem[] {
    return [
      menuItem("open", "Open"),
      menuItem("copy", "Copy to other book"),
      menuItem("move", "Move to other book"),
      menuItem("delete", "Delete"),
    ];
  }

  function onMenuAction(rootNode: RootNode, action: string) {
    if (action == "open") {
      setCurrentRootNode(rootNode.clone());
    } else if (action == "delete") {
      setDialogInfo({ type: "confirm-delete", rootNode });
    } else if (action == "move") {
      setDialogInfo({ type: "move", rootNode });
    } else if (action == "copy") {
      setDialogInfo({ type: "copy", rootNode });
    }
  }

  function addGame(type: RootNodeType) {
    const rootNode = RootNode.fromInitialPosition(type);
    if (type == RootNodeType.Training) {
      rootNode.setColor("white");
    }
    setCurrentRootNode(rootNode);
  }

  function onDeleteGame(rootNode: RootNode) {
    const index = findRootNodeIndex(rootNode.id);
    props.book.rootNodes.splice(index, 1);
    setDialogInfo(null);
  }

  async function onReorder(id: string, insertAfter: string) {
    const index = findRootNodeIndex(id);
    const insertAfterIndex = findRootNodeIndex(insertAfter);
    props.book.rootNodes.splice(
      insertAfterIndex,
      0,
      ...props.book.rootNodes.splice(index, 1),
    );
    await props.status.perform("saving book", async () => {
      await props.storage.writeBook(props.filename, props.book);
    });
    setReorderCounter(reorderCounter() + 1);
  }

  async function onMoveGame(rootNode: RootNode, path: string) {
    const otherBook = await props.storage.readBook(path);
    otherBook.rootNodes.push(rootNode);

    const index = findRootNodeIndex(rootNode.id);
    props.book.rootNodes.splice(index, 1);

    await props.status.perform("saving", async () => {
      await props.storage.writeBook(path, otherBook);
      await props.storage.writeBook(props.filename, props.book);
    });

    setDialogInfo(null);
  }

  async function onCopyGame(rootNode: RootNode, path: string) {
    const otherBook = await props.storage.readBook(path);
    otherBook.rootNodes.push(rootNode);

    await props.status.perform("saving", async () => {
      await props.storage.writeBook(path, otherBook);
    });

    setDialogInfo(null);
  }

  async function onEditorSave(): Promise<boolean> {
    const current = currentRootNode();
    if (current === null) {
      return false;
    }
    const index = props.book.rootNodes.findIndex((n) => n.id == current.id);
    if (index > -1) {
      props.book.rootNodes[index] = current.clone();
    } else {
      props.book.rootNodes.push(current.clone());
    }
    let success = false;
    await props.status.perform("saving book", async () => {
      await props.storage.writeBook(props.filename, props.book);
      success = true;
    });
    return success;
  }

  async function onTrainBook(): Promise<boolean> {
    let success = false;
    await props.status.perform("opening training", async () => {
      const path = props.storage.absPath(props.filename);
      const training = await props.storage.loadTraining(path);
      props.controls.setPage({
        name: "training",
        initialTraining: training,
      });
      success = true;
    });
    return success;
  }

  function onEditorExit() {
    setCurrentRootNode(null);
  }

  const dialog = createMemo(() => {
    const info = dialogInfo();
    if (info === null) {
      return null;
    } else if (info.type == "confirm-delete") {
      const index = findRootNodeIndex(info.rootNode.id);
      return (
        <Dialog
          onSubmit={() => onDeleteGame(info.rootNode)}
          onClose={() => setDialogInfo(null)}
          title="Confirm delete"
          submitText="Delete"
          closeText="Cancel"
        >
          <div>
            Are you sure you want to delete {info.rootNode.displayName(index)} ?
          </div>
        </Dialog>
      );
    } else if (info.type == "move") {
      return (
        <ChooserDialog
          title="Move game to other book"
          storage={props.storage.clone()}
          onSelect={async (path) => onMoveGame(info.rootNode, path)}
          onClose={() => {
            setDialogInfo(null);
          }}
        />
      );
    } else if (info.type == "copy") {
      return (
        <ChooserDialog
          title="Copy game to other book"
          storage={props.storage.clone()}
          onSelect={async (path) => onCopyGame(info.rootNode, path)}
          onClose={() => {
            setDialogInfo(null);
          }}
        />
      );
    } else if (info.type == "edit-training") {
      return (
        <EditTrainingInfoDialog
          meta={trainingMeta()}
          onSave={async (meta) => {
            mutateTrainingMeta(meta);
            props.book.trainingMeta = meta;
            await props.status.perform("saving training", async () => {
              await props.storage.writeBook(props.filename, props.book);
            });
            setDialogInfo(null);
          }}
          onClose={() => setDialogInfo(null)}
        />
      );
    }
  });

  return (
    <Switch>
      <Match when={dialog()} keyed>
        {(dialog) => dialog}
      </Match>
      <Match when={currentRootNode()} keyed>
        {(rootNode) => (
          <Editor
            name={props.filename}
            rootNode={rootNode}
            onSave={onEditorSave}
            onExit={onEditorExit}
          />
        )}
      </Match>
      <Match when={true}>
        <div class="pt-4 px-10">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-3xl">Editing book: {props.filename}</h2>
            <Button text="Exit" onClick={props.onExit} />
          </div>
          <Show when={props.book.rootNodes.length > 0}>
            <div class="flex gap-8">
              <Table
                each={rootNodes()}
                columns={3}
                onReorder={onReorder}
                menu={menu}
                onMenuSelect={onMenuAction}
                growColumn={1}
                onClick={(entry) => onMenuAction(entry, "open")}
              >
                {(item) => (
                  <>
                    <TableGripperCell item={item} />
                    <TableCell grow item={item} class="flex items-center gap-2">
                      {item.value.displayName(item.index())}
                    </TableCell>
                    <TableMenuCell item={item} />
                  </>
                )}
              </Table>
              <Show when={props.book.hasTraining()}>
                <div class="flex flex-col w-80 gap-1">
                  <h3 class="text-xl">Training Info</h3>
                  <Show when={trainingMeta()}>
                    {(meta) => {
                      const now = Date.now();
                      const m = meta();
                      return (
                        <>
                          <div class="flex items-center gap-2">
                            Rank: <TrainingRankIcon rank={m.rank} />
                          </div>
                          <div class="flex items-center gap-2">
                            Last trained: {lastTrainedTimeDisplay(m, now)}
                          </div>
                          <div class="flex items-center gap-2">
                            Next rank in: {nextRankAvailableTimeDisplay(m, now)}
                          </div>
                          <Button
                            class="mt-4"
                            text="Train book"
                            onClick={onTrainBook}
                          />
                          <Button
                            text="Edit training info"
                            onClick={() =>
                              setDialogInfo({ type: "edit-training" })
                            }
                          />
                        </>
                      );
                    }}
                  </Show>
                </div>
              </Show>
            </div>
          </Show>
          <div class="flex pt-8 gap-8">
            <Button
              text="Add game"
              onClick={() => addGame(RootNodeType.Normal)}
            />
            <Button
              title="Training games contains move to memorize.  They can be tested from the training page."
              text="Add training game"
              onClick={() => addGame(RootNodeType.Training)}
            />
          </div>
        </div>
      </Match>
    </Switch>
  );
}

interface EditTrainingInfoDialogProps {
  meta: TrainingMeta | undefined;
  onSave: (meta: TrainingMeta) => void;
  onClose: () => void;
}

function EditTrainingInfoDialog(props: EditTrainingInfoDialogProps) {
  const [draft, setDraft] = createSignal<TrainingMeta | undefined>(props.meta);
  createEffect(() => {
    if (props.meta) {
      setDraft(props.meta);
    }
  });

  function rankMenuItem(rank: number): MenuItem {
    return menuItem(rank.toString(), "", {
      icon: <TrainingRankIcon rank={rank} />,
    });
  }

  return (
    <Dialog
      onSubmit={() => {
        const toSave = draft();
        if (toSave) {
          props.onSave(toSave);
        } else {
          props.onClose();
        }
      }}
      onClose={props.onClose}
      title="Edit training info"
      submitText="Save"
      closeText="Cancel"
    >
      <Show fallback=<Loader /> when={draft()}>
        {(draft) => {
          return (
            <>
              <MenuButton
                onSelect={(rankString) => {
                  setDraft({
                    ...draft(),
                    rank: Number.parseInt(rankString),
                  });
                }}
                icon={
                  <div class="flex items-center gap-2">
                    Rank
                    <TrainingRankIcon rank={draft().rank} />
                  </div>
                }
                style="flat"
                items={[
                  rankMenuItem(TrainingRank.Silver1),
                  rankMenuItem(TrainingRank.Silver2),
                  rankMenuItem(TrainingRank.Silver3),
                  rankMenuItem(TrainingRank.Silver4),
                  rankMenuItem(TrainingRank.Gold1),
                  rankMenuItem(TrainingRank.Gold2),
                  rankMenuItem(TrainingRank.Gold3),
                  rankMenuItem(TrainingRank.Gold4),
                  rankMenuItem(TrainingRank.Diamond1),
                  rankMenuItem(TrainingRank.Diamond2),
                  rankMenuItem(TrainingRank.Diamond3),
                  rankMenuItem(TrainingRank.Diamond4),
                ]}
              />
            </>
          );
        }}
      </Show>
    </Dialog>
  );
}
