import { createSignal, Index, Show, Switch, Match } from "solid-js";
import { Toast, Toaster, createToaster } from "@ark-ui/solid";
import BookPlus from "lucide-solid/icons/book-plus";
import FolderPlus from "lucide-solid/icons/folder-plus";
import Loader from "lucide-solid/icons/loader-2";
import type { DirEntry } from "~/lib/storage";
import type { LibraryStorage } from "./storage";
import { FileExistsError, joinPath } from "~/lib/storage";
import { Button } from "~/Button";
import { Editor } from "../editor";
import { CreateFileDialog } from "./CreateFileDialog";
import { BooksList } from "./BooksList";

interface LibraryBrowserProps {
  storage: LibraryStorage;
}

export function LibraryBrowser(props: LibraryBrowserProps) {
  const [dialog, setDialog] = createSignal("");
  const [currentBook, setCurrentBook] = createSignal<string>();

  const toaster = createToaster({
    placement: "bottom-end",
    gap: 24,
  });

  async function onCreateBook(name: string) {
    if (await props.storage.exists(name)) {
      throw new FileExistsError();
    }
    setCurrentBook(name);
    setDialog("");
  }

  async function onSaveBook(content: string) {
    const filename = currentBook();
    setCurrentBook(undefined);
    if (filename) {
      try {
        await props.storage.createFile(filename, content);
      } catch (e) {
        toaster.create({
          title: "Create book failed",
          description: `${e}`,
          type: "error",
        });
      }
    }
  }

  async function onExitBook() {
    setCurrentBook(undefined);
  }

  async function onCreateFolder(name: string) {
    if (await props.storage.exists(name)) {
      throw new FileExistsError();
    }
    setDialog("");
    try {
      await props.storage.createDir(name);
    } catch (e) {
      toaster.create({
        title: "Create folder failed",
        description: `${e}`,
        type: "error",
      });
    }
  }

  async function moveFile(sourceFilename: string, destFilename: string) {
    const fullPath = joinPath(destFilename, sourceFilename);
    if (await props.storage.exists(joinPath(destFilename, sourceFilename))) {
      toaster.create({
        title: "Move failed",
        description: `${fullPath} already exists`,
        type: "error",
      });
      return;
    }
    try {
      await props.storage.move(sourceFilename, destFilename);
      toaster.create({
        title: "Move successful",
        description: `${sourceFilename} moved to ${destFilename}`,
        type: "info",
      });
    } catch (e) {
      toaster.create({
        title: "Move failed",
        description: `${e}`,
        type: "error",
      });
    }
  }

  async function onFileMenuAction(entry: DirEntry, action: string) {
    if (action == "delete") {
      try {
        await props.storage.remove(entry.filename);
        toaster.create({
          title: "Delete successful",
          description: `${entry.filename} was removed`,
          type: "info",
        });
      } catch (e) {
        toaster.create({
          title: "Delete failed",
          description: `${e}`,
          type: "error",
        });
      }
    }
  }

  return (
    <>
      <Switch>
        <Match when={currentBook()}>
          <Editor onSave={onSaveBook} onExit={onExitBook} />
        </Match>
        <Match when={!currentBook()}>
          <div class="grow px-8 py-4">
            <Switch>
              <Match when={props.storage.files.loading}>
                <div class="text-3xl flex gap-2 items-center justify-center">
                  <Loader class="animate-spin duration-1000" size={32} />
                  Loading books
                </div>
              </Match>
              <Match when={props.storage.files.error}>
                <div class="text-3xl flex gap-2 items-center justify-center">
                  Error loading books
                </div>
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
                <div class="text-lg pb-4">
                  <Index each={props.storage.dirComponents()}>
                    {(component, index) => (
                      <>
                        <Show when={index != 0}>
                          <span class="mx-2">/</span>
                        </Show>
                        <Switch>
                          <Match
                            when={
                              index < props.storage.dirComponents().length - 1
                            }
                          >
                            <button
                              class="hover:text-sky-600 dark:hover:text-sky-300 cursor-pointer"
                              onClick={() =>
                                props.storage.setDir(component().path)
                              }
                            >
                              {component().filename}
                            </button>
                          </Match>
                          <Match
                            when={
                              index == props.storage.dirComponents().length - 1
                            }
                          >
                            <span>{component().filename}</span>
                          </Match>
                        </Switch>
                      </>
                    )}
                  </Index>
                </div>
                <BooksList
                  files={props.storage.files()!}
                  onDirClick={(entry) => props.storage.setDir(entry.filename)}
                  onFileAction={onFileMenuAction}
                  onFileDrag={moveFile}
                />
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
          <CreateFileDialog
            title="Create New Book"
            submitText="Create Book"
            open={dialog() == "create-book"}
            onClose={() => setDialog("")}
            onCreate={onCreateBook}
          />
          <CreateFileDialog
            title="Create New Folder"
            submitText="Create Folder"
            open={dialog() == "create-folder"}
            onClose={() => setDialog("")}
            onCreate={onCreateFolder}
          />
          <Toaster toaster={toaster}>
            {(toast) => (
              <Toast.Root class="border-1 border-zinc-600 w-120 shadow-md shadow-zinc-800 dark:shadow-zinc-950 py-2 px-2">
                <Toast.Title class="font-bold text-lg">
                  {toast().title}
                </Toast.Title>
                <Toast.Description>{toast().description}</Toast.Description>
              </Toast.Root>
            )}
          </Toaster>
        </Match>
      </Switch>
    </>
  );
}
