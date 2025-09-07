import { createSignal, Index, Show, Switch, Match } from "solid-js";
import { Toast, Toaster, createToaster } from "@ark-ui/solid";
import BookPlus from "lucide-solid/icons/book-plus";
import FolderPlus from "lucide-solid/icons/folder-plus";
import X from "lucide-solid/icons/x";
import type { DirEntry, AppStorage } from "~/lib/storage";
import { FileExistsError, joinPath } from "~/lib/storage";
import type { Book } from "~/lib/node";
import { Button, Chooser, Layout } from "~/components";
import { Editor } from "../editor";
import { CreateBook } from "./CreateBook";
import { CreateFolder } from "./CreateFolder";
import { BooksList } from "./BooksList";

export interface LibraryProps {
  storage: AppStorage;
}

export interface CurrentBook {
  filename: string;
  book: Book;
}

export function Library(props: LibraryProps) {
  const [mode, setMode] = createSignal("");
  const [currentBook, setCurrentBook] = createSignal<CurrentBook>();
  const [moveSource, setMoveSource] = createSignal<DirEntry[]>([]);

  const toaster = createToaster({
    placement: "bottom-end",
    gap: 24,
  });

  async function onCreateBook(name: string, book: Book) {
    let filename = name;
    if (!filename.endsWith(".pgn")) {
      filename += ".pgn";
    }
    if (await props.storage.exists(filename)) {
      throw new FileExistsError();
    }
    setCurrentBook({ filename, book });
    setMode("");
  }

  async function onSaveBook(): Promise<boolean> {
    const book = currentBook();
    if (!book) {
      return false;
    }
    let success = false;
    await props.storage.status.perform("saving book", async () => {
      try {
        await props.storage.writeFile(book.filename, book.book.export());
        props.storage.refetchFiles();
        toaster.create({
          title: "Book saved",
          type: "success",
        });
        success = true;
      } catch (e) {
        toaster.create({
          title: "Book failed to save",
          description: `${e}`,
          type: "error",
        });
      }
    });
    return success;
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
    setMode("");
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
        title: entry.type == "file" ? "Deleting file" : "Deleting folder",
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
      setMode("move");
      setMoveSource([entry]);
    }
  }

  function cloneMove() {
    setMode("");
    setMoveSource([]);
  }

  async function completeMove(destDir: string) {
    const sources = moveSource();

    cloneMove();
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
      description: `${sourceName} -> Home${destDir}`,
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
    <Layout
      navbar={currentBook() === undefined && mode() == ""}
      status={props.storage.status}
    >
      <Switch>
        <Match when={mode() == "create-book"} keyed>
          <CreateBook
            title="Create New Book"
            storage={props.storage.clone()}
            submitText="Create Book"
            onClose={() => setMode("")}
            onCreate={onCreateBook}
          />
        </Match>
        <Match when={mode() == "create-folder"} keyed>
          <CreateFolder
            title="Create New Folder"
            storage={props.storage.clone()}
            submitText="Create Folder"
            onClose={() => setMode("")}
            onCreate={onCreateFolder}
          />
        </Match>
        <Match when={mode() == "move"}>
          <Chooser
            storage={props.storage.clone()}
            title={`Moving: ${moveSource()
              .map((e) => e.filename)
              .join(", ")}`}
            subtitle="Select destination folder"
            onSelect={completeMove}
            onClose={cloneMove}
            dirMode
            selectDirText="Move here"
          />
        </Match>
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
          <div class="grow flex flex-col">
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
            <Show when={props.storage.files()} keyed>
              {(files) => {
                if (files.length == 0 && props.storage.dir() == "/") {
                  return (
                    <div class="pt-4">
                      <h2 class="text-3xl">Welcome to Chess Files</h2>
                      <p class="text-lg pt-1">
                        Use the "Create Book" button below to start building
                        your library
                      </p>
                    </div>
                  );
                } else {
                  return (
                    <div class="min-h-0 overflow-y-auto grow">
                      <BooksList
                        files={files}
                        onFileAction={onFileMenuAction}
                      />
                    </div>
                  );
                }
              }}
            </Show>
          </div>
          <div class="flex pt-8 gap-8">
            <Button
              text="Create Book"
              icon={<BookPlus />}
              onClick={() => setMode("create-book")}
            />
            <Button
              text="Create Folder"
              icon={<FolderPlus />}
              onClick={() => setMode("create-folder")}
            />
          </div>
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
    </Layout>
  );
}
