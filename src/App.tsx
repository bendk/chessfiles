import { createSignal, createEffect, Match, Switch } from "solid-js";
import { completeLogin } from "~/lib/auth";
import { AppStorage } from "./lib/storage";
import { Library } from "./library";
import { Settings } from "./settings/Settings";
import { Training } from "./training/Training";
import { Status, StatusTracker } from "./components";

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

function App() {
  if (completeLogin()) {
    return <></>;
  }

  const storage = new AppStorage();
  const status = new StatusTracker();

  const [page, setPage] = createSignal("library");
  const [theme, setTheme] = createSignal(themeFromLocalStorage());

  if (window.location.hash.startsWith("#settings")) {
    setPage("settings");
  }

  createEffect(() => {
    document.documentElement.classList.toggle("dark", theme() == "dark");
    localStorage.setItem("theme", theme());
  });

  return (
    <div class="text-md flex flex-col bg-gray-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 min-h-screen outline-hidden">
      <Switch>
        <Match when={page() == "library"}>
          <Library storage={storage} status={status} setPage={setPage} />
        </Match>
        <Match when={page() == "training"}>
          <Training storage={storage} status={status} setPage={setPage} />
        </Match>
        <Match when={page() == "settings"}>
          <Settings
            storage={storage}
            status={status}
            theme={theme()}
            setTheme={setTheme}
            setPage={setPage}
          />
        </Match>
      </Switch>
      <Status status={status} />
    </div>
  );
}

export default App;
