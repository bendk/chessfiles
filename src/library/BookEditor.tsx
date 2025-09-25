import { createSignal, Match, Show, Switch } from "solid-js";
import type { Book } from "~/lib/node";
import { BookType, RootNode } from "~/lib/node";
import { Editor } from "../editor";
import type { MenuItem, StatusTracker } from "../components";
import {
  Button,
  Dialog,
  Table,
  TableCell,
  TableGripperCell,
  TableMenuCell,
} from "../components";

export interface BookEditorProps {
  book: Book;
  filename: string;
  onSave: () => Promise<boolean>;
  onExit: () => void;
  status: StatusTracker;
}

export function BookEditor(props: BookEditorProps) {
  const [reorderCounter, setReorderCounter] = createSignal(0);
  const [currentRootNode, setCurrentRootNode] = createSignal<RootNode | null>(
    props.book.type == BookType.Opening ? props.book.rootNodes[0] : null,
  );
  const [confirmDeleteData, setConfirmDeleteData] = createSignal<
    [RootNode, number] | null
  >(null);

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
      {
        value: "open",
        text: "Open",
      },
      {
        value: "reorder",
        text: "Reorder",
      },
      {
        value: "delete",
        text: "Delete",
      },
    ];
  }

  function onMenuAction(rootNode: RootNode, action: string) {
    if (action == "open") {
      setCurrentRootNode(rootNode.clone());
    } else if (action == "delete") {
      const index = findRootNodeIndex(rootNode.id);
      setConfirmDeleteData([rootNode, index]);
    }
  }

  function addGame() {
    const rootNode = RootNode.fromInitialPosition();
    props.book.rootNodes.push(rootNode);
    setCurrentRootNode(rootNode);
  }

  function onDeleteGame(rootNode: RootNode) {
    const index = findRootNodeIndex(rootNode.id);
    props.book.rootNodes.splice(index, 1);
    setConfirmDeleteData(null);
  }

  async function onReorder(id: string, insertAfter: string) {
    const index = findRootNodeIndex(id);
    const insertAfterIndex = findRootNodeIndex(insertAfter);
    props.book.rootNodes.splice(
      insertAfterIndex,
      0,
      ...props.book.rootNodes.splice(index, 1),
    );
    await props.onSave();
    setReorderCounter(reorderCounter() + 1);
  }

  async function onEditorSave(): Promise<boolean> {
    const current = currentRootNode();
    if (current === null) {
      return false;
    }
    const index = props.book.rootNodes.findIndex((n) => n.id == current.id);
    if (index == -1) {
      console.error(
        "onEditorSave: can't find root node",
        props.book.rootNodes,
        current,
      );
      return false;
    }
    props.book.rootNodes[index] = current.clone();
    return props.onSave();
  }

  function onEditorExit() {
    if (props.book.type == BookType.Opening) {
      props.onExit();
    } else {
      setCurrentRootNode(null);
    }
  }

  return (
    <Switch>
      <Match when={confirmDeleteData()} keyed>
        {([rootNode, index]) => {
          return (
            <Dialog
              onSubmit={() => onDeleteGame(rootNode)}
              onClose={() => setConfirmDeleteData(null)}
              title="Confirm delete"
              submitText="Delete"
              closeText="Cancel"
            >
              <div>
                Are you sure you want to delete {rootNode.displayName(index)} ?
              </div>
            </Dialog>
          );
        }}
      </Match>
      <Match when={currentRootNode()} keyed>
        {(rootNode) => (
          <Editor
            name={props.filename}
            rootNode={rootNode}
            bookType={props.book.type}
            onSave={onEditorSave}
            onExit={onEditorExit}
          />
        )}
      </Match>
      <Match when={props.book.type == BookType.Normal}>
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
          <Button text="Add game" onClick={addGame} />
        </div>
      </Match>
    </Switch>
  );
}
