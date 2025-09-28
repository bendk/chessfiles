import {
  createEffect,
  createSignal,
  Index,
  Show,
  Switch,
  Match,
} from "solid-js";
import BookPlus from "lucide-solid/icons/book-plus";
import FolderPlus from "lucide-solid/icons/folder-plus";
import type { DirEntry, AppStorage } from "~/lib/storage";
import { FileExistsError, joinPath } from "~/lib/storage";
import type { Book } from "~/lib/node";
import type { StatusTracker } from "~/components";
import { Button, Chooser, StatusError } from "~/components";
import { CreateBook } from "./CreateBook";
import { CreateFolder } from "./CreateFolder";
import { BooksList } from "./BooksList";
import { BookEditor } from "./BookEditor";

export interface LibraryProps {
  storage: AppStorage;
  status: StatusTracker;
  setNavbarShown: (shown: boolean) => void;
}

export interface CurrentBook {
  filename: string;
  book: Book;
}

export function Library(props: LibraryProps) {
  const [mode, setMode] = createSignal("");
  const [currentBook, setCurrentBook] = createSignal<CurrentBook>();
  const [moveSource, setMoveSource] = createSignal<DirEntry[]>([]);

  createEffect(() =>
    props.setNavbarShown(currentBook() === undefined && mode() == ""),
  );

  async function onCreateBook(name: string, book: Book): Promise<boolean> {
    let filename = name;
    if (!filename.endsWith(".pgn")) {
      filename += ".pgn";
    }
    if (await props.storage.exists(filename)) {
      return false;
    }
    setCurrentBook({ filename, book });
    setMode("");
    return true;
  }

  async function onSaveBook(): Promise<boolean> {
    const book = currentBook();
    if (!book) {
      return false;
    }
    let success = false;
    await props.status.perform("saving book", async () => {
      await props.storage.writeFile(book.filename, book.book.export());
      props.storage.refetchFiles();
      success = true;
    });
    return success;
  }

  async function onExitBook() {
    setCurrentBook(undefined);
  }

  async function onCreateFolder(name: string) {
    let fileExists = false;
    await props.status.perform(
      {
        title: "Creating folder",
        description: name,
      },
      async () => {
        // TODO: throw FileExistsError upwards
        if (await props.storage.exists(name)) {
          fileExists = true;
          return;
        }
        await props.storage.createDir(name);
      },
    );
    props.storage.refetchFiles();
    setMode("");
    return fileExists;
  }

  async function onFileMenuAction(entry: DirEntry, action: string) {
    if (action == "open") {
      if (entry.type == "dir") {
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
      props.status.perform(
        {
          title: entry.type == "file" ? "Deleting file" : "Deleting folder",
          description: `${entry.filename}`,
        },
        async () => {
          await props.storage.remove(entry.filename);
          props.storage.refetchFiles();
        },
      );
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

    props.status.perform(
      {
        title: "Moving files",
        description: `${sourceName} -> Home${destDir}`,
      },
      async () => {
        for (const source of sources) {
          const destPath = joinPath(destDir, source.filename);
          try {
            await props.storage.move(source.filename, destPath);
          } catch (e) {
            if (e instanceof FileExistsError) {
              throw new StatusError(`${destPath} already exists`);
            } else {
              throw e;
            }
          }
        }
      },
    );
  }

  return (
    <>
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
          <>
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
          </>
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
    </>
  );
}
