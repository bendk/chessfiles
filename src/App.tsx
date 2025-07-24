import { createSignal, createEffect, Match, Show, Switch } from "solid-js";
import { completeLogin } from "~/lib/auth";
import { AppStorage } from "./lib/storage";
import { Library } from "./library";
import { StandardNavbar } from "./StandardNavbar";
import { Settings } from "./Settings";
import { Training } from "./training/Training";

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
  const [navbarShown, setNavbarShown] = createSignal(true);
  const [page, setPage] = createSignal("library");
  const storage = new AppStorage();

  if (window.location.hash.startsWith("#settings")) {
    setPage("settings");
  }

  createEffect(() => {
    document.documentElement.classList.toggle("dark", theme() == "dark");
    localStorage.setItem("theme", theme());
  });

  return (
    <div class="flex flex-col bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-300 h-screen outline-hidden">
      <Show when={navbarShown()}>
        <StandardNavbar
          page={page()}
          setPage={setPage}
          theme={theme()}
          setTheme={setTheme}
        />
      </Show>
      <Switch>
        <Match when={page() == "library"}>
          <Library storage={storage} setNavbarShown={setNavbarShown} />
        </Match>
        <Match when={page() == "training"}>
          <Training storage={storage} setNavbarShown={setNavbarShown} />
        </Match>
        <Match when={page() == "settings"}>
          <Settings storage={storage} />
        </Match>
      </Switch>
    </div>
  );
}

export default App;
