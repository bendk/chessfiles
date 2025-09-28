import { createSignal, createEffect, Match, Show, Switch } from "solid-js";
import { completeLogin } from "~/lib/auth";
import { AppStorage } from "./lib/storage";
import { Library } from "./library";
import { Settings } from "./settings/Settings";
import { Training } from "./training/Training";
import { Navbar, Status, StatusTracker } from "./components";

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
  const [navbarShown, setNavbarShown] = createSignal(true);

  if (window.location.hash.startsWith("#settings")) {
    setPage("settings");
  }

  createEffect(() => {
    document.documentElement.classList.toggle("dark", theme() == "dark");
    localStorage.setItem("theme", theme());
  });

  return (
    <div class="text-md flex flex-col bg-gray-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 h-screen outline-hidden">
      <Show when={navbarShown()}>
        <Navbar
          page={page()}
          theme={theme()}
          setPage={setPage}
          setTheme={setTheme}
          setNavbarShown={setNavbarShown}
        />
      </Show>
      <div class="flex flex-col min-h-0 pt-4 px-10 grow">
        <Switch>
          <Match when={page() == "library"}>
            <Library
              storage={storage}
              status={status}
              setNavbarShown={setNavbarShown}
            />
          </Match>
          <Match when={page() == "training"}>
            <Training
              storage={storage}
              status={status}
              setNavbarShown={setNavbarShown}
            />
          </Match>
          <Match when={page() == "settings"}>
            <Settings
              storage={storage}
              status={status}
              theme={theme()}
              setTheme={setTheme}
              setNavbarShown={setNavbarShown}
            />
          </Match>
        </Switch>
      </div>
      <Status status={status} />
    </div>
  );
}

export default App;
