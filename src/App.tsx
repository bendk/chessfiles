import { createSignal, createEffect, Switch, Match } from "solid-js";
import { completeLogin } from "~/lib/auth";
import { Library, LibraryStorage } from "./library";
import { Navbar } from "./Navbar";
import { Settings } from "./Settings";
import { Training } from "./Training";

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

  const [theme, setTheme] = createSignal(themeFromLocalStorage());
  const [page, setPage] = createSignal("library");
  const storage = new LibraryStorage();

  if (window.location.hash.startsWith("#settings")) {
    setPage("settings");
  }

  createEffect(() => {
    document.documentElement.classList.toggle("dark", theme() == "dark");
    localStorage.setItem("theme", theme());
  });

  return (
    <div class="flex flex-col bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-300 h-screen outline-hidden">
      <div class="text-zinc-200 bg-zinc-800 dark:bg-slate-800 dark:text-zinc-300">
        <Navbar
          page={page()}
          setPage={setPage}
          theme={theme()}
          setTheme={setTheme}
        />
      </div>
      <Switch>
        <Match when={page() == "library"}>
          <Library storage={storage} />
        </Match>
        <Match when={page() == "training"}>
          <Training />
        </Match>
        <Match when={page() == "settings"}>
          <Settings storage={storage} />
        </Match>
      </Switch>
    </div>
  );
}

export default App;
