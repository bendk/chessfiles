import { createSignal, createMemo, Index, Show, Switch, Match } from "solid-js";
import BookPlus from "lucide-solid/icons/book-plus";
import BulkMode from "lucide-solid/icons/list-todo";
import Copy from "lucide-solid/icons/copy";
import FolderPlus from "lucide-solid/icons/folder-plus";
import MoveRight from "lucide-solid/icons/move-right";
import Square from "lucide-solid/icons/square";
import SquareCheck from "lucide-solid/icons/square-check";
import Trash from "lucide-solid/icons/trash-2";
import type { AppStorage, DirEntry, OperationCallbacks } from "~/lib/storage";
import { normalizeNewFilename, joinPath } from "~/lib/storage";
import type { Book } from "~/lib/node";
import type { AppControls, StatusTracker } from "~/components";
import { Button, ChooserDialog, Dialog, StandardLayout } from "~/components";
import { CreateBookDialog } from "./CreateBookDialog";
import { CreateFolderDialog } from "./CreateFolderDialog";
import { BooksList } from "./BooksList";
import { BookEditor } from "./BookEditor";
import { ProgressDialog } from "./ProgressDialog";
import { RenameFile } from "./RenameFile";

export interface LibraryProps {
  storage: AppStorage;
  status: StatusTracker;
  controls: AppControls;
  initialPath?: string;
}

export interface CurrentBook {
  filename: string;
  book: Book;
}

type Dialog =
  | { type: "null" }
  | { type: "create-book" }
  | { type: "create-folder" }
  | {
      type: "chooser";
      operation: "move" | "copy";
      files: DirEntry[];
    }
  | {
      type: "confirm-delete";
      files: DirEntry[];
    }
  | {
      type: "rename";
      file: DirEntry;
    }
  | {
      type: "operation-progress";
      title: string;
      operation: (callbacks: OperationCallbacks) => Promise<void>;
    };

export function Library(props: LibraryProps) {
  const [dialog, setDialog] = createSignal<Dialog>({ type: "null" });

  const [bulkMode, setBulkMode] = createSignal(false);
  const [selectedFiles, setSelectedFiles] = createSignal<Set<DirEntry>>(
    new Set(),
    { equals: false },
  );
  const [currentBook, setCurrentBook] = createSignal<CurrentBook>();

  if (props.initialPath) {
    props.storage.setDir(props.initialPath);
  }

  function unsetDialog() {
    setDialog({ type: "null" });
    setBulkMode(false);
  }

  async function onCreateBook(name: string, book: Book): Promise<boolean> {
    const filename = normalizeNewFilename(name, "file");
    if (await props.storage.exists(filename)) {
      return false;
    }
    setCurrentBook({ filename, book });
    unsetDialog();
    return true;
  }

  async function onSaveBook(): Promise<boolean> {
    const book = currentBook();
    if (!book) {
      return false;
    }
    let success = false;
    await props.status.perform("saving book", async () => {
      await props.storage.writeBook(book.filename, book.book);
      props.storage.refetchFiles();
      success = true;
    });
    return success;
  }

  async function onExitBook() {
    setCurrentBook(undefined);
  }

  function toggleSelected(entry: DirEntry) {
    const files = selectedFiles();
    if (files.has(entry)) {
      files.delete(entry);
    } else {
      files.add(entry);
    }
    setSelectedFiles(files);
  }

  async function onCreateFolder(name: string): Promise<boolean> {
    let fileExists = false;
    await props.status.perform(
      {
        title: "Creating folder",
        description: name,
      },
      async () => {
        if (await props.storage.exists(name)) {
          fileExists = true;
          return;
        }
        await props.storage.createDir(name);
      },
    );
    if (fileExists) {
      return true;
    }
    props.storage.refetchFiles();
    unsetDialog();
    return false;
  }

  function onFileClick(entry: DirEntry) {
    if (bulkMode()) {
      toggleSelected(entry);
    } else {
      onFileMenuAction(entry, "open");
    }
  }

  async function onFileMenuAction(entry: DirEntry, action: string) {
    if (action == "open") {
      if (entry.type == "dir" || entry.type == "engine") {
        props.storage.setDir(entry.filename);
      } else if (entry.type == "file") {
        props.status.perform("opening book", async () => {
          const book = await props.storage.readBook(entry.filename);
          setCurrentBook({
            filename: entry.filename,
            book,
          });
        });
      }
    } else if (action == "delete") {
      setDialog({
        type: "confirm-delete",
        files: [entry],
      });
    } else if (action == "rename") {
      setDialog({
        type: "rename",
        file: entry,
      });
    } else if (action == "duplicate") {
      props.status.perform("duplicating file", async () => {
        const files = props.storage.files();
        let newFilename = `Copy of ${entry.filename}`;
        let i = 0;
        while (files.findIndex((e) => e.filename == newFilename) != -1) {
          newFilename = `Copy of ${newFilename}`;
          if (i++ == 10) {
            throw Error("duplicate: Can't find new filename");
          }
        }
        const content = await props.storage.readFile(entry.filename);
        await props.storage.writeFile(
          joinPath(props.storage.dir(), newFilename),
          content,
        );
        props.storage.refetchFiles();
      });
    } else if (action == "copy") {
      setDialog({
        type: "chooser",
        operation: "copy",
        files: [entry],
      });
    } else if (action == "move") {
      setDialog({
        type: "chooser",
        operation: "move",
        files: [entry],
      });
    }
  }

  function performOperation(
    title: string,
    fileCount: number,
    operation: (callbacks: OperationCallbacks) => Promise<void>,
  ) {
    if (fileCount <= 1) {
      props.status.perform(
        {
          title,
        },
        () => operation({}),
      );
      unsetDialog();
    } else {
      setDialog({
        type: "operation-progress",
        title,
        operation,
      });
    }
  }

  function onBulkMenuAction(action: string) {
    if (action == "move") {
      setDialog({
        type: "chooser",
        operation: "move",
        files: Array.from(selectedFiles()),
      });
    } else if (action == "copy") {
      setDialog({
        type: "chooser",
        operation: "copy",
        files: Array.from(selectedFiles()),
      });
    } else if (action == "delete") {
      setDialog({
        type: "confirm-delete",
        files: Array.from(selectedFiles()),
      });
    }
    setSelectedFiles(new Set<DirEntry>());
  }

  const renderedDialog = createMemo(() => {
    const d = dialog();

    if (d.type === "null") {
      return null;
    } else if (d.type == "create-book") {
      return (
        <CreateBookDialog
          storage={props.storage.clone()}
          onClose={unsetDialog}
          onCreate={onCreateBook}
        />
      );
    } else if (d.type == "create-folder") {
      return (
        <CreateFolderDialog
          storage={props.storage.clone()}
          onClose={unsetDialog}
          onCreate={onCreateFolder}
        />
      );
    } else if (d.type == "chooser" && d.operation == "move") {
      return (
        <ChooserDialog
          storage={props.storage.clone()}
          sources={d.files}
          title="Move files"
          subtitle="Select destination"
          onSelect={(destDir) =>
            performOperation("Moving files", d.files.length, (callbacks) =>
              props.storage.move(d.files, destDir, callbacks),
            )
          }
          onClose={unsetDialog}
          dirMode
          validate={(path) => path != "/" && path != props.storage.dir()}
          selectDirText="Move here"
        />
      );
    } else if (d.type == "chooser" && d.operation == "copy") {
      return (
        <ChooserDialog
          storage={props.storage.clone()}
          sources={d.files}
          title="Copy files"
          subtitle="Select destination"
          onSelect={(destDir) =>
            performOperation("Copying files", d.files.length, (callbacks) =>
              props.storage.copy(d.files, destDir, callbacks),
            )
          }
          onClose={unsetDialog}
          dirMode
          validate={(path) => path != "/" && path != props.storage.dir()}
          selectDirText="Copy here"
        />
      );
    } else if (d.type == "confirm-delete") {
      return (
        <Dialog
          onSubmit={() =>
            performOperation("Deleting files", d.files.length, (callbacks) =>
              props.storage.delete(d.files, callbacks),
            )
          }
          onClose={unsetDialog}
          title="Confirm delete"
          submitText="Delete"
        >
          <div>This will permanently delete {d.files.length} files</div>
        </Dialog>
      );
    } else if (d.type == "rename") {
      return (
        <RenameFile
          storage={props.storage}
          status={props.status}
          filename={d.file.filename}
          fileType={d.file.type}
          onSubmit={(newFilename: string) => {
            unsetDialog();
            newFilename = normalizeNewFilename(newFilename, d.file.type);
            props.status.perform("Renaming", async () => {
              await props.storage.rename(d.file.filename, newFilename);
              props.storage.refetchFiles();
            });
          }}
          onClose={unsetDialog}
        />
      );
    } else if (d.type == "operation-progress") {
      return (
        <ProgressDialog
          title={d.title}
          onClose={unsetDialog}
          operation={d.operation}
        />
      );
    }
    throw Error(`invalid dialog: ${d}`);
  });

  return (
    <>
      <Switch>
        <Match when={currentBook()} keyed>
          {(currentBook) => (
            <BookEditor
              filename={currentBook.filename}
              book={currentBook.book}
              onSave={onSaveBook}
              onExit={onExitBook}
              status={props.status}
            />
          )}
        </Match>
        <Match when={!currentBook()}>
          {renderedDialog()}
          <StandardLayout page="files" controls={props.controls}>
            <div class="text-lg pb-4 flex items-center">
              <Index each={props.storage.dirComponents()}>
                {(component, index) => (
                  <>
                    <Show when={index != 0}>
                      <span class="mx-2">/</span>
                    </Show>
                    <Switch>
                      <Match
                        when={index < props.storage.dirComponents().length - 1}
                      >
                        <button
                          class="hover:text-sky-600 dark:hover:text-sky-300 cursor-pointer"
                          onClick={() => {
                            props.storage.setDir(component().path);
                            setBulkMode(false);
                          }}
                        >
                          {component().icon}
                          {component().filename}
                        </button>
                      </Match>
                      <Match
                        when={index == props.storage.dirComponents().length - 1}
                      >
                        {component().icon}
                        {component().filename}
                      </Match>
                    </Switch>
                  </>
                )}
              </Index>
            </div>
            <Show when={true}>
              <div class="min-h-0 overflow-y-auto grow">
                <BooksList
                  storage={props.storage}
                  bulkMode={bulkMode()}
                  selectedFiles={selectedFiles()}
                  setSelectedFiles={setSelectedFiles}
                  onFileAction={onFileMenuAction}
                  onClick={onFileClick}
                />
              </div>
            </Show>
            <Switch>
              <Match when={!bulkMode()}>
                <div class="flex pt-11 gap-8">
                  <Button
                    text="Bulk select"
                    icon={<BulkMode />}
                    disabled={props.storage.dir() == "/"}
                    onClick={() => {
                      setBulkMode(true);
                      setSelectedFiles(new Set<DirEntry>());
                    }}
                  />
                  <Button
                    text="Create Book"
                    icon={<BookPlus />}
                    onClick={() => setDialog({ type: "create-book" })}
                  />
                  <Button
                    text="Create Folder"
                    icon={<FolderPlus />}
                    onClick={() => setDialog({ type: "create-folder" })}
                  />
                </div>
              </Match>
              <Match when={bulkMode()}>
                <h2 class="pt-4">{selectedFiles().size} files selected</h2>
                <div class="flex pt-2 gap-8">
                  <Button
                    text="Cancel"
                    icon={<Square />}
                    onClick={() => {
                      setBulkMode(false);
                      setSelectedFiles(new Set<DirEntry>());
                    }}
                  />
                  <Button
                    text="Select all"
                    icon={<SquareCheck />}
                    onClick={() =>
                      setSelectedFiles(new Set(props.storage.files()))
                    }
                  />
                  <Button
                    text="Copy"
                    icon={<Copy />}
                    onClick={() => onBulkMenuAction("copy")}
                  />
                  <Button
                    text="Move"
                    icon={<MoveRight />}
                    onClick={() => onBulkMenuAction("move")}
                  />
                  <Button
                    text="Delete"
                    icon={<Trash />}
                    onClick={() => onBulkMenuAction("delete")}
                  />
                </div>
              </Match>
            </Switch>
          </StandardLayout>
        </Match>
      </Switch>
    </>
  );
}
