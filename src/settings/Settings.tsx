import { createSignal, Match, Switch } from "solid-js";
import type { AppStorage } from "~/lib/storage";
import * as settings from "~/lib/settings";
import * as dropbox from "~/lib/auth/dropbox";
import { Button, Layout } from "~/components";
import { ImportPane } from "./ImportPane";

type Storage = "browser" | "dropbox";

function removeHash() {
  history.pushState(
    "",
    document.title,
    window.location.pathname + window.location.search,
  );
}

export interface StorageProps {
  storage: AppStorage;
}

export function Settings(props: StorageProps) {
  const [importPane, setImportPane] = createSignal(false);

  if (window.location.hash.startsWith("#settings-dropbox")) {
    settings.setStorage("dropbox");
    removeHash();
  }

  const onStorageClick = (value: Storage) => {
    return () => {
      if (settings.storage() == value) {
        return;
      }

      if (value == "browser") {
        settings.setStorage("browser");
      } else if (value == "dropbox") {
        if (dropbox.isAuthorized()) {
          settings.setStorage("dropbox");
        } else {
          dropbox.startLogin();
        }
      }
    };
  };

  return (
    <Layout navbar={!importPane()}>
      <Switch>
        <Match when={importPane()}>
          <ImportPane
            storage={props.storage}
            onClose={() => setImportPane(false)}
          />
        </Match>
        <Match when={!importPane()}>
          <div class="min-w-200 mx-auto flex flex-col gap-8 text-lg py-4">
            <div>
              <h3 class="pb-1">Storage</h3>
              <div class="flex justify-between">
                <div class="flex gap-2">
                  <Button
                    text="Browser"
                    selected={settings.storage() == "browser"}
                    onClick={onStorageClick("browser")}
                  />
                  <Button
                    text="Dropbox"
                    selected={settings.storage() == "dropbox"}
                    onClick={onStorageClick("dropbox")}
                  />
                </div>
              </div>
            </div>
            <div>
              <h3 class="pb-1">Engine</h3>
              <div class="flex gap-2">
                <Button text="None" disabled={true} />
                <Button text="Stockfish (in-browser)" disabled={true} />
                <Button text="Stockfish (ec2)" disabled={true} />
              </div>
            </div>
            <div>
              <h3 class="pb-1">Opening Book</h3>
              <div class="flex gap-2">
                <Button text="None" disabled={true} />
                <Button text="Lichess" disabled={true} />
              </div>
            </div>
            <div>
              <h3 class="pb-1">Endgame Tablebase</h3>
              <div class="flex gap-2">
                <Button text="None" disabled={true} />
                <Button text="Lichess" disabled={true} />
              </div>
            </div>

            <div>
              <h3 class="pb-1 pt-16">Tools</h3>
              <div class="flex gap-2">
                <Button
                  text="Import books"
                  onClick={() => setImportPane(true)}
                />
              </div>
            </div>
          </div>
        </Match>
      </Switch>
    </Layout>
  );
}
