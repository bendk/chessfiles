import IconMoon from "lucide-solid/icons/moon";
import IconSun from "lucide-solid/icons/sun";
import IconBook from "lucide-solid/icons/book";
import IconSettings from "lucide-solid/icons/settings";
import IconTodo from "lucide-solid/icons/list-todo";
import type { JSX } from "solid-js";
import { Match, Show, Switch } from "solid-js";
import { Menu } from "./components";

interface NavbarLinkProps {
  text?: string;
  name: string;
  icon?: JSX.Element;
  page: string;
  setPage: (page: string) => void;
}

function NavbarLink(props: NavbarLinkProps) {
  const current = () => props.page === props.name;
  return (
    <a
      class="flex gap-1 items-center mx-3 text-lg cursor-pointer font-medium"
      classList={{
        "border-b-2 border-sky-500": current(),
        "hover:text-sky-300": !current(),
        "px-2": props.text === undefined,
      }}
      aria-current={current() ? "page" : undefined}
      onClick={() => props.setPage(props.name)}
    >
      <Show when={props.icon}>{props.icon}</Show>
      <Show when={props.text}>{props.text}</Show>
    </a>
  );
}

export interface NavbarProps {
  page: string;
  theme: string;
  setPage: (page: string) => void;
  setNavbarShown: (shown: boolean) => void;
  setTheme: (theme: string) => void;
}

export function Navbar(props: NavbarProps) {
  return (
    <nav class="text-zinc-200 bg-zinc-800 dark:bg-slate-800 dark:text-zinc-300 h-16 py-4 px-10 flex items-center justify-between py-4 px-10">
      <div class="flex gap-2 items-center">
        <NavbarLink
          name="library"
          text="Library"
          icon={<IconBook size={16} />}
          page={props.page}
          setPage={props.setPage}
        />
        <NavbarLink
          name="training"
          text="Training"
          icon={<IconTodo size={16} />}
          page={props.page}
          setPage={props.setPage}
        />
      </div>
      <div class="flex items-center gap-2">
        <Menu
          elt={
            <Switch>
              <Match when={props.theme === "light"}>
                <IconSun size={16} />
              </Match>
              <Match when={props.theme === "dark"}>
                <IconMoon fill="currentColor" size={16} />
              </Match>
            </Switch>
          }
          items={[
            {
              value: "light",
              icon: <IconSun size={16} />,
              text: "Light",
              selected: props.theme == "light",
            },
            {
              value: "dark",
              icon: <IconMoon size={16} />,
              text: "Dark",
              selected: props.theme == "dark",
            },
          ]}
          onSelect={(value) => props.setTheme(value)}
        />
        <NavbarLink
          name="settings"
          text={props.page == "settings" ? "Settings" : undefined}
          icon={<IconSettings size={16} />}
          page={props.page}
          setPage={props.setPage}
        />
      </div>
    </nav>
  );
}
