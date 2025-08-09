import IconMoon from "lucide-solid/icons/moon";
import IconSun from "lucide-solid/icons/sun";
import IconBook from "lucide-solid/icons/book";
import IconSettings from "lucide-solid/icons/settings";
import IconTodo from "lucide-solid/icons/list-todo";
import type { JSX } from "solid-js";
import { Match, Show, Switch, useContext } from "solid-js";
import { AppContext, Menu, Navbar } from "./components";

interface NavbarLinkProps {
  text?: string;
  name: string;
  icon?: JSX.Element;
}

function NavbarLink(props: NavbarLinkProps) {
  const context = useContext(AppContext);
  const current = () => context.page() === props.name;
  return (
    <a
      class="flex gap-1 items-center mx-3 text-lg cursor-pointer font-medium"
      classList={{
        "border-b-2 border-sky-500": current(),
        "hover:text-sky-300": !current(),
        "px-2": props.text === undefined,
      }}
      aria-current={current() ? "page" : undefined}
      onClick={() => context.setPage(props.name)}
    >
      <Show when={props.icon}>{props.icon}</Show>
      <Show when={props.text}>{props.text}</Show>
    </a>
  );
}

export function StandardNavbar() {
  const context = useContext(AppContext);

  return (
    <Navbar class="flex items-center justify-between py-4 px-10">
      <div class="flex gap-2 items-center">
        <NavbarLink
          name="library"
          text="Library"
          icon={<IconBook size={16} />}
        />
        <NavbarLink
          name="training"
          text="Training"
          icon={<IconTodo size={16} />}
        />
      </div>
      <div class="flex items-center gap-2">
        <Menu
          elt={
            <Switch>
              <Match when={context.theme() === "light"}>
                <IconSun size={16} />
              </Match>
              <Match when={context.theme() === "dark"}>
                <IconMoon fill="currentColor" size={16} />
              </Match>
            </Switch>
          }
          items={[
            {
              value: "light",
              icon: <IconSun size={16} />,
              text: "Light",
              selected: context.theme() == "light",
            },
            {
              value: "dark",
              icon: <IconMoon size={16} />,
              text: "Dark",
              selected: context.theme() == "dark",
            },
          ]}
          onSelect={(value) => context.setTheme(value)}
        />
        <NavbarLink
          name="settings"
          text={context.page() == "settings" ? "Settings" : undefined}
          icon={<IconSettings size={16} />}
        />
      </div>
    </Navbar>
  );
}
