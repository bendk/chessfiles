import { createSignal, Index, Match, Show, Switch } from "solid-js";
import type { TrainingActivity } from "~/lib/activity";
import * as settings from "~/lib/settings";
import type { AppStorage, StorageMeta } from "~/lib/storage";
import type { Training, TrainingMeta } from "~/lib/training";
import {
  assertIsStorage,
  createStorage,
  joinPath,
  FileExistsError,
} from "~/lib/storage";
import type { ChessfilesStorage, DirEntry } from "~/lib/storage";
import { ChessfilesStorageLocal } from "~/lib/storage";
import { Button } from "~/Button";
import { Progress } from "~/Progress";
import * as RadioGroup from "~/RadioGroup";

type ImportStatus = "configuring" | "importing" | "done";
type ConflictChoice = "overwrite" | "skip";

class Importer {
  private sourceItems: [string, DirEntry][] = [];
  private source?: ChessfilesStorage;
  private onOverwriteChoice?: (
    choice: "overwrite" | "skip" | "overwrite-all" | "skip-all",
  ) => void;
  private conflictChoice?: ConflictChoice;
  private importedTrainingActivity: TrainingActivity[] = [];
  private importedTrainingMetas: Map<string, TrainingMeta> = new Map();

  constructor(
    private dest: ChessfilesStorage,
    private setStatus: (status: ImportStatus) => void,
    private setProgress: (progress: number) => void,
    private pushImportLog: (msg: string) => void,
    private setConflictPath: (path: string | undefined) => void,
    private setError: (msg: string) => void,
  ) {}

  async import(source: ChessfilesStorage) {
    this.source = source;
    this.setStatus("importing");
    await this.collectSourceItems("/");
    this.setProgress(0);
    for (let i = 0; i < this.sourceItems.length; i++) {
      try {
        await this.importItem(this.sourceItems[i]);
      } catch {
        this.setError("Import failed");
        this.setStatus("done");
        return;
      }
      this.setProgress((100 * i) / this.sourceItems.length + 1);
    }
    this.importMeta();
    this.setProgress(100);
    this.setStatus("done");
  }

  private async collectSourceItems(path: string) {
    this.pushImportLog(`reading ${path}`);
    const entries = await this.source!.listDir(path);
    for (const entry of entries) {
      this.sourceItems.push([path, entry]);
      if (entry.type == "dir") {
        this.collectSourceItems(joinPath(path, entry.filename));
      }
    }
  }

  private async importItem(item: [string, DirEntry], overwrite = false) {
    const [dir, entry] = item;
    const path = joinPath(dir, entry.filename);
    if (entry.type == "dir") {
      this.pushImportLog(`creating ${path}`);
      try {
        await this.dest.createDir(path);
      } catch (e) {
        if (e instanceof FileExistsError) {
          return;
        }
        console.log("ERROR: ", e);
        throw e;
      }
    } else {
      this.pushImportLog(`importing ${path}`);
      const content = await this.source!.readFile(path);

      if (path == "/ChessfilesData.json") {
        const data = JSON.parse(content);
        console.log(data);
        if (data.trainingActivity !== undefined) {
          this.importedTrainingActivity = data.trainingActivity;
        } else {
          console.error(`${path} missing "trainingActivity"`);
        }
        return;
      }

      try {
        await this.dest.createFile(path, content);
        this.onFileSaved(path, content);
      } catch (e) {
        if (e instanceof FileExistsError) {
          if (overwrite || this.conflictChoice == "overwrite") {
            await this.dest.writeFile(path, content);
            this.onFileSaved(path, content);
          } else if (this.conflictChoice == "skip") {
            this.pushImportLog(`skipping ${path}`);
          } else {
            await this.handleConflict(path, item);
          }
          return;
        }
        throw e;
      }
    }
  }

  private onFileSaved(path: string, content: string) {
    if (path.startsWith("/ChessfilesTraining/")) {
      const data = JSON.parse(content);
      if (data.meta !== undefined) {
        this.importedTrainingMetas.set(data.meta.bookId, data.meta);
      } else {
        console.error(`${path} missing "meta"`);
      }
    }
  }

  private async handleConflict(path: string, item: [string, DirEntry]) {
    if (path.startsWith("/ChessfilesTraining/")) {
      try {
        const training = JSON.parse(await this.dest.readFile(path)) as Training;
        this.setConflictPath(`Duplicate Training file: ${training.meta.name}`);
      } catch (e) {
        console.error(`Error parsing training file: ${path} (${e})`);
        this.setConflictPath("Duplicate training file: <unknown>");
      }
    } else {
      this.setConflictPath(`Duplicate file: ${path}`);
    }
    const promise = new Promise((resolve) => {
      this.onOverwriteChoice = resolve;
    });
    const choice = await promise;
    this.setConflictPath(undefined);
    if (choice == "overwrite") {
      this.importItem(item, true);
    } else if (choice == "overwrite-all") {
      this.conflictChoice = "overwrite";
      this.importItem(item, true);
    } else if (choice == "skip-all") {
      this.conflictChoice = "skip";
      this.pushImportLog(`skipping ${path}`);
    } else {
      // skip
      this.pushImportLog(`skipping ${path}`);
      return;
    }
  }

  handleConflictChoice(
    choice: "overwrite" | "skip" | "overwrite-all" | "skip-all",
  ) {
    if (this.onOverwriteChoice) {
      this.onOverwriteChoice(choice);
    }
  }

  private async importMeta() {
    const meta = JSON.parse(
      await this.dest.readFile("/ChessfilesData.json"),
    ) as StorageMeta;

    // Merge activity
    const currentActivity = new Set(meta.activity.map((a) => a.id));
    for (const activity of this.importedTrainingActivity) {
      if (!currentActivity.has(activity.id)) {
        meta.activity.push(activity);
      }
    }
    meta.activity.sort((a, b) => a.timestamp - b.timestamp);

    // Merge training metas
    for (let i = 0; i < meta.trainingMeta.length; i++) {
      const bookId = meta.trainingMeta[i].bookId;
      const imported = this.importedTrainingMetas.get(bookId);
      if (imported) {
        meta.trainingMeta[i] = imported;
        this.importedTrainingMetas.delete(bookId);
      }
    }

    for (const imported of this.importedTrainingMetas.values()) {
      meta.trainingMeta.push(imported);
    }

    // Skip trainingSettings, the user can manually do it if they want

    await this.dest.writeFile("/ChessfilesData.json", JSON.stringify(meta));
  }
}

export interface ImportPaneProps {
  storage: AppStorage;
  onClose: () => void;
}

export function ImportPane(props: ImportPaneProps) {
  const [source, setSource] = createSignal();
  const [status, setStatus] = createSignal<ImportStatus>("configuring");
  const [importLog, setImportLog] = createSignal<string[]>([]);
  const [progress, setProgress] = createSignal<number | null>(null);
  const [conflictPath, setConflictPath] = createSignal<string>();
  const [error, setError] = createSignal<string>();

  const importer = new Importer(
    new ChessfilesStorageLocal(),
    setStatus,
    setProgress,
    (msg) => setImportLog([...importLog(), msg]),
    setConflictPath,
    setError,
  );

  function title(): string {
    const currentStatus = status();
    if (currentStatus == "done") {
      return "Import complete";
    } else if (currentStatus == "importing") {
      return "Importing...";
    }
    const storage = settings.storage();
    if (storage == "dropbox") {
      return "Import Books to Dropbox";
    } else {
      return "Import Books to Browser local storage";
    }
  }

  async function onImport() {
    const sourceVal = source();
    assertIsStorage(sourceVal);
    await importer.import(createStorage(sourceVal));
  }

  return (
    <>
      <div class="flex justify-between">
        <h1 class="text-2xl pb-4">{title()}</h1>
        <Button text="Exit" onClick={props.onClose} />
      </div>
      <Switch>
        <Match when={status() == "configuring"}>
          <div class="flex flex-col">
            <div class="grow">
              <RadioGroup.Root onValueChange={(value) => setSource(value)}>
                <RadioGroup.Label text="From" />
                <RadioGroup.Item
                  text="Browser"
                  value="browser"
                  disabled={settings.storage() == "browser"}
                />
                <RadioGroup.Item
                  text="Dropbox"
                  value="dropbox"
                  disabled={settings.storage() == "dropbox"}
                />
              </RadioGroup.Root>
            </div>
            <div class="pt-8 flex">
              <Button
                text="Import"
                onClick={onImport}
                disabled={source() === undefined}
              />
            </div>
          </div>
        </Match>
        <Match when={status() != "configuring"}>
          <div class="flex flex-col">
            <ul class="h-40 overflow-auto mb-8">
              <Index each={importLog()}>{(log) => <li>{log()}</li>}</Index>
            </ul>
            <div class="grow" />
            <Show when={conflictPath() != undefined}>
              <div class="text-amber-600 dark:text-amber-300">
                {conflictPath()}
              </div>
              <div class="flex pt-2 justify-between">
                <div class="flex gap-4">
                  <Button
                    text="Overwrite"
                    onClick={() => importer.handleConflictChoice("overwrite")}
                  />
                  <Button
                    text="Skip"
                    onClick={() => importer.handleConflictChoice("skip")}
                  />
                </div>
                <div class="flex gap-4">
                  <Button
                    text="Overwrite All"
                    onClick={() =>
                      importer.handleConflictChoice("overwrite-all")
                    }
                  />
                  <Button
                    text="Skip all"
                    onClick={() => importer.handleConflictChoice("skip-all")}
                  />
                </div>
              </div>
            </Show>
            <Show when={error()}>
              <div class="text-red-500">{error()}</div>
            </Show>
            <Show when={progress() != null}>
              <Progress value={progress()} />
            </Show>
            <Switch>
              <Match when={status() != "done"}>
                <div class="h-8"></div>
              </Match>
              <Match when={status() == "done"}>
                <div class="flex justify-between pt-8">
                  <Button text="Finish" onClick={props.onClose} />
                </div>
              </Match>
            </Switch>
          </div>
        </Match>
      </Switch>
    </>
  );
}
