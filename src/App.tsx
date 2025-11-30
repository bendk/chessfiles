import { createSignal, createEffect, Match, Switch } from "solid-js";
import { completeLogin } from "~/lib/auth";
import { AppStorage } from "./lib/storage";
import { Library } from "./library";
import type { Training as TrainingData } from "./lib/training";
import { Training } from "./training/Training";
import { Home, Status, StatusTracker } from "./components";

function themeFromLocalStorage(): string {
  const storedValue = localStorage.getItem("theme");
  if (
    storedValue === "dark" ||
    (storedValue === undefined &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    return "dark";
  } else {
    return "light";
  }
}

export interface AppControls {
  setPage: (page: Page) => void;
  theme: () => string;
  setTheme: (theme: string) => void;
}

export interface Page {
  name: string;
  initialPath?: string;
  initialTraining?: TrainingData;
}

function App() {
  if (completeLogin()) {
    return <></>;
  }

  const storage = new AppStorage();
  const status = new StatusTracker();

  const [page, setPage] = createSignal<Page>({ name: "home" });
  const [theme, setTheme] = createSignal(themeFromLocalStorage());

  const controls = { setPage, theme, setTheme };

  createEffect(() => {
    document.documentElement.classList.toggle("dark", theme() == "dark");
    localStorage.setItem("theme", theme());
  });

  return (
    <div class="text-md flex flex-col bg-bg-1 text-fg-1 min-h-screen outline-hidden">
      <Switch>
        <Match when={page().name == "home"}>
          <Home storage={storage} status={status} controls={controls} />
        </Match>
        <Match when={page().name == "files"}>
          <Library
            storage={storage}
            status={status}
            controls={controls}
            initialPath={page().initialPath}
          />
        </Match>
        <Match when={page().name == "training"}>
          <Training
            storage={storage}
            status={status}
            controls={controls}
            initialTraining={page().initialTraining}
          />
        </Match>
      </Switch>
      <Status status={status} />
    </div>
  );
}

export default App;
