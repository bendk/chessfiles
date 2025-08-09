import {
  createContext,
  createSignal,
  createEffect,
  Match,
  Switch,
} from "solid-js";
import { completeLogin } from "~/lib/auth";
import { AppStorage } from "./lib/storage";
import { Library } from "./library";
import { Settings } from "./settings/Settings";
import { Training } from "./training/Training";

export class AppContextClass {
  page: () => string;
  setPage: (page: string) => void;
  theme: () => string;
  setTheme: (page: string) => void;

  constructor() {
    [this.page, this.setPage] = createSignal("library");
    [this.theme, this.setTheme] = createSignal(themeFromLocalStorage());
  }
}

// Slightly weird: we need to construct an AppContextClass here and for `AppContext.Provider.value`
// or else typescript will complain.
export const AppContext = createContext<AppContextClass>(new AppContextClass());

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

  const context = new AppContextClass();
  const storage = new AppStorage();

  if (window.location.hash.startsWith("#settings")) {
    context.setPage("settings");
  }

  createEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      context.theme() == "dark",
    );
    localStorage.setItem("theme", context.theme());
  });

  return (
    <AppContext.Provider value={context}>
      <Switch>
        <Match when={context.page() == "library"}>
          <Library storage={storage} />
        </Match>
        <Match when={context.page() == "training"}>
          <Training storage={storage} />
        </Match>
        <Match when={context.page() == "settings"}>
          <Settings storage={storage} />
        </Match>
      </Switch>
    </AppContext.Provider>
  );
}

export default App;
