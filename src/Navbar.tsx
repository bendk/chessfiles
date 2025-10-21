import IconBook from "lucide-solid/icons/book";
import IconHouse from "lucide-solid/icons/house";
import IconSettings from "lucide-solid/icons/settings";
import IconTodo from "lucide-solid/icons/list-todo";
import type { JSX } from "solid-js";
import { Show } from "solid-js";
import type { Page } from "~/components";

interface NavbarLinkProps {
  text?: string;
  name: string;
  icon?: JSX.Element;
  page: string;
  setPage: (page: Page) => void;
}

function NavbarLink(props: NavbarLinkProps) {
  const current = () => props.page === props.name;
  return (
    <a
      class="flex gap-1 items-center mx-3 pb-0.5 text-lg cursor-pointer font-medium"
      classList={{
        "border-b-2 border-sky-500": current(),
        "hover:text-sky-300": !current(),
        "px-2": props.text === undefined,
      }}
      aria-current={current() ? "page" : undefined}
      onClick={() => props.setPage({ name: props.name })}
    >
      <Show when={props.icon}>{props.icon}</Show>
      <Show when={props.text}>{props.text}</Show>
    </a>
  );
}

export interface NavbarProps {
  page: string;
  setPage: (page: Page) => void;
}

export function Navbar(props: NavbarProps) {
  return (
    <nav class="text-zinc-200 bg-zinc-800 dark:bg-slate-800 dark:text-zinc-300 h-16 py-4 px-10 flex items-center justify-between py-4 px-10">
      <div class="flex gap-2 items-center">
        <NavbarLink
          name="home"
          text="Home"
          icon={<IconHouse size={16} />}
          page={props.page}
          setPage={props.setPage}
        />
        <NavbarLink
          name="files"
          text="Files"
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
        <NavbarLink
          name="settings"
          text="Settings"
          icon={<IconSettings size={16} />}
          page={props.page}
          setPage={props.setPage}
        />
      </div>
    </nav>
  );
}
