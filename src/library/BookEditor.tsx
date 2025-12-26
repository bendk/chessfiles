import { createMemo, createSignal, Match, Show, Switch } from "solid-js";
import type { Book } from "~/lib/node";
import { RootNode, RootNodeType } from "~/lib/node";
import type { AppStorage } from "~/lib/storage";
import { Editor } from "../editor";
import type { MenuItem, StatusTracker } from "../components";
import {
  menuItem,
  Button,
  ChooserDialog,
  Dialog,
  Table,
  TableCell,
  TableGripperCell,
  TableMenuCell,
} from "../components";

export interface BookEditorProps {
  book: Book;
  storage: AppStorage;
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
    };

export function BookEditor(props: BookEditorProps) {
  const [reorderCounter, setReorderCounter] = createSignal(0);
  const [dialogInfo, setDialogInfo] = createSignal<DialogInfo | null>(null);

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
