import {
  createEffect,
  createSignal,
  Index,
  Show,
  Switch,
  Match,
} from "solid-js";
import { Toast, Toaster, createToaster } from "@ark-ui/solid";
import BookPlus from "lucide-solid/icons/book-plus";
import FolderPlus from "lucide-solid/icons/folder-plus";
import Loader from "lucide-solid/icons/loader-2";
import X from "lucide-solid/icons/x";
import type { DirEntry, AppStorage } from "~/lib/storage";
import { FileExistsError, joinPath } from "~/lib/storage";
import { Book, RootNode } from "~/lib/node";
import { Button } from "~/Button";
import { Editor } from "../editor";
import { CreateFileDialog } from "./CreateFileDialog";
import { BooksList } from "./BooksList";
import { Chooser } from "./Chooser";

export interface LibraryProps {
  storage: AppStorage;
  setNavbarShown: (shown: boolean) => void;
}

export interface CurrentBook {
  filename: string;
  book: Book;
}

export function Library(props: LibraryProps) {
  const [dialog, setDialog] = createSignal("");
  const [currentBook, setCurrentBook] = createSignal<CurrentBook>();
  const [moveSource, setMoveSource] = createSignal<DirEntry[]>([]);

  createEffect(() => {
    props.setNavbarShown(currentBook() === undefined);
  });

  const toaster = createToaster({
    placement: "bottom-end",
    gap: 24,
  });

  async function onCreateBook(filename: string) {
    if (await props.storage.exists(filename)) {
      throw new FileExistsError();
    }
    setCurrentBook({
      filename,
      book: new Book([RootNode.fromInitialPosition()]),
    });
    setDialog("");
  }

  async function onSaveBook(): Promise<boolean> {
    const book = currentBook();
    if (book) {
      try {
        await props.storage.writeFile(book.filename, book.book.export());
        props.storage.refetchFiles();
        toaster.create({
          title: "Book saved",
          type: "success",
        });
        return true;
      } catch (e) {
        toaster.create({
          title: "Book failed to save",
          description: `${e}`,
          type: "error",
        });
      }
    }
    return false;
  }

  async function onExitBook() {
    setCurrentBook(undefined);
  }

  async function onCreateFolder(name: string) {
    if (await props.storage.exists(name)) {
      throw new FileExistsError();
    }
    try {
      await props.storage.createDir(name);
      props.storage.refetchFiles();
    } catch (e) {
      toaster.create({
        title: "Create folder failed",
        description: `${e}`,
        type: "error",
      });
    }
    setDialog("");
  }

  async function onFileMenuAction(entry: DirEntry, action: string) {
    if (action == "open") {
      if (entry.type == "dir") {
        props.storage.setDir(entry.filename);
      } else if (entry.type == "file") {
        const book = await props.storage.readBook(entry.filename);
        setCurrentBook({
          filename: entry.filename,
          book,
        });
      }
    } else if (action == "delete") {
      const toast = toaster.create({
        title: "Deleting file",
        description: `${entry.filename}`,
        type: "info",
      });
      try {
        await props.storage.remove(entry.filename);
        toaster.update(toast, {
          title: "Delete successful",
          description: `${entry.filename}`,
          type: "success",
        });
        props.storage.refetchFiles();
      } catch (e) {
        toaster.update(toast, {
          title: "Delete failed",
          description: `${e}`,
          type: "error",
        });
      }
    } else if (action == "move") {
      setDialog("move");
      setMoveSource([entry]);
    }
  }

  function closeMoveDialog() {
    setDialog("");
    setMoveSource([]);
  }

  async function completeMoveDialog(destDir: string) {
    const sources = moveSource();

    closeMoveDialog();
    let sourceName;
    if (sources.length == 0 || destDir == props.storage.dir()) {
      return;
    } else if (sources.length == 1) {
      sourceName = sources[0].filename;
    } else {
      sourceName = `${sources.length} files`;
    }

    const toast = toaster.create({
      title: "Moving",
      description: `${sourceName} -> ${destDir}`,
      type: "info",
    });

    for (const source of sources) {
      const destPath = joinPath(destDir, source.filename);
      try {
        await props.storage.move(source.filename, destPath);
      } catch (e) {
        let description;
        if (e instanceof FileExistsError) {
          description = `${destPath} already exists`;
        } else {
          console.log(e);
          description = "";
        }
        toaster.update(toast, {
          title: "Move failed",
          description,
          type: "error",
        });
        return;
      }
    }

    toaster.update(toast, {
      title: "Move successful",
      description: `${sourceName} -> ${destDir}`,
      type: "success",
    });
  }

  return (
    <>
      <Switch>
        <Match when={currentBook()} keyed>
          {(currentBook) => (
            <Editor
              filename={currentBook.filename}
              rootNode={currentBook.book.rootNodes[0]}
              onSave={onSaveBook}
              onExit={onExitBook}
            />
          )}
        </Match>
        <Match when={!currentBook()}>
          <div class="grow flex flex-col min-h-0 px-8 py-4">
            <div class="text-lg pb-4">
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
                          onClick={() => props.storage.setDir(component().path)}
                        >
                          {component().filename}
                        </button>
                      </Match>
                      <Match
                        when={index == props.storage.dirComponents().length - 1}
                      >
                        <span>{component().filename}</span>
                      </Match>
                    </Switch>
                  </>
                )}
              </Index>
            </div>
            <Switch>
              <Match when={props.storage.files.loading}>
                <Loader class="animate-spin duration-1000" size={32} />
              </Match>
              <Match when={props.storage.files.error}>
                <div class="text-2xl flex gap-2">Error loading files</div>
              </Match>
              <Match
                when={
                  props.storage.files.state == "ready" &&
                  props.storage.files().length == 0 &&
                  props.storage.dir() == "/"
                }
              >
                <div class="pt-4">
                  <h2 class="text-3xl">Welcome to Chess Files</h2>
                  <p class="text-lg pt-1">
                    Use the "Create Book" button below to start building your
                    library
                  </p>
                </div>
              </Match>
              <Match when={props.storage.files.state == "ready"}>
                <div class="min-h-0 overflow-y-auto grow">
                  <BooksList
                    files={props.storage.files()!}
                    onFileAction={onFileMenuAction}
                  />
                </div>
              </Match>
            </Switch>
          </div>
          <div class="flex py-4 px-4 gap-8">
            <Button
              text="Create Book"
              icon={<BookPlus />}
              onClick={() => setDialog("create-book")}
            />
            <Button
              text="Create Folder"
              icon={<FolderPlus />}
              onClick={() => setDialog("create-folder")}
            />
          </div>
        </Match>
      </Switch>
      <Switch>
        <Match when={dialog() == "create-book"} keyed>
          <CreateFileDialog
            title="Create New Book"
            submitText="Create Book"
            onClose={() => setDialog("")}
            onCreate={onCreateBook}
          />
        </Match>
        <Match when={dialog() == "create-folder"} keyed>
          <CreateFileDialog
            title="Create New Folder"
            submitText="Create Folder"
            onClose={() => setDialog("")}
            onCreate={onCreateFolder}
          />
        </Match>
        <Match when={dialog() == "move"}>
          <Chooser
            title="Moving files"
            onSelect={completeMoveDialog}
            onClose={closeMoveDialog}
            dirMode
            selectDirText="Move here"
          />
        </Match>
      </Switch>
      <Toaster toaster={toaster}>
        {(toast) => (
          <Toast.Root
            class="border-1 border-zinc-600 w-120 shadow-md shadow-zinc-800 dark:shadow-zinc-950 py-2 px-2 data-[type=success]:text-sky-600 data-[type=success]:dark:text-sky-500 data-[type=error]:text-red-500"
            style="translate: var(--x) var(--y);"
          >
            <div class="flex justify-between">
              <Toast.Title class="font-bold text-lg">
                {toast().title}
              </Toast.Title>
              <Toast.CloseTrigger class="cursor-pointer text-zinc-800 dark:text-zinc-300 hover:text-red-500">
                <X />
              </Toast.CloseTrigger>
            </div>
            <Toast.Description class="text-zinc-800 dark:text-zinc-300">
              {toast().description}
            </Toast.Description>
          </Toast.Root>
        )}
      </Toaster>
    </>
  );
}
