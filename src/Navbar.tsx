import IconMoon from "lucide-solid/icons/moon";
import IconSun from "lucide-solid/icons/sun";
import IconBook from "lucide-solid/icons/book";
import IconSettings from "lucide-solid/icons/settings";
import IconTodo from "lucide-solid/icons/list-todo";
import type { JSX } from "solid-js";
import { Menu } from "@ark-ui/solid";
import { Match, Show, Switch, splitProps } from "solid-js";

interface NavbarButtonProps {
  text?: string;
  name: string;
  page: string;
  setPage: (name: string) => void;
  icon?: JSX.Element;
}

function NavbarLink(props: NavbarButtonProps) {
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

interface NavbarProps {
  theme: string;
  setTheme: (theme: string) => void;
  page: string;
  setPage: (name: string) => void;
}

export function Navbar(props: NavbarProps) {
  const [buttonProps] = splitProps(props, ["page", "setPage"]);
  return (
    <nav class="flex items-center justify-between py-4 px-10">
      <div class="flex gap-2 items-center">
        <NavbarLink
          name="library"
          text="Library"
          icon={<IconBook size={16} />}
          {...buttonProps}
        />
        <NavbarLink
          name="training"
          text="Training"
          icon={<IconTodo size={16} />}
          {...buttonProps}
        />
      </div>
      <div class="flex items-center gap-2">
        <Menu.Root
          onSelect={(item) => props.setTheme(item.value)}
          positioning={{ placement: "bottom" }}
        >
          <Menu.Trigger class="cursor-pointer outline-hidden hover:text-sky-300 px-2">
            <Switch>
              <Match when={props.theme === "light"}>
                <IconSun size={16} />
              </Match>
              <Match when={props.theme === "dark"}>
                <IconMoon fill="currentColor" size={16} />
              </Match>
            </Switch>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content class="bg-zinc-900 shadow-md shadow-zinc-800 dark:shadow-zinc-950 outline-0 flex flex-col gap-1">
              <Menu.Item
                value="light"
                class="flex items-center text-lg gap-2 cursor-pointer hover:bg-slate-700 pl-4 pr-16 py-2"
                classList={{
                  "bg-slate-700": props.theme == "light",
                }}
              >
                <IconSun size={16} /> Light
              </Menu.Item>
              <Menu.Item
                value="dark"
                class="flex items-center text-lg gap-2 cursor-pointer hover:bg-slate-700 pl-4 pr-16 py-2"
                classList={{
                  "bg-slate-700": props.theme == "dark",
                }}
              >
                <IconMoon size={16} /> Dark
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
        <NavbarLink
          name="settings"
          text={props.page == "settings" ? "Settings" : undefined}
          icon={<IconSettings size={16} />}
          {...buttonProps}
        />
      </div>
    </nav>
  );
}
