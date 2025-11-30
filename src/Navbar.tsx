import IconBook from "lucide-solid/icons/book";
import IconHouse from "lucide-solid/icons/house";
import IconMoon from "lucide-solid/icons/moon";
import IconSun from "lucide-solid/icons/sun";
import IconTodo from "lucide-solid/icons/list-todo";
import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { Button } from "~/components";
import type { AppControls } from "~/components";

interface NavbarLinkProps {
  text?: string;
  name: string;
  icon?: JSX.Element;
  page: string;
  controls: AppControls;
}

function NavbarLink(props: NavbarLinkProps) {
  const current = () => props.page === props.name;
  return (
    <a
      class="flex gap-1 items-center mx-3 pb-0.5 text-lg cursor-pointer font-medium"
      classList={{
        "border-b-2 border-highlight-1": current(),
        "hover:text-highlight-1": !current(),
        "px-2": props.text === undefined,
      }}
      aria-current={current() ? "page" : undefined}
      onClick={() => props.controls.setPage({ name: props.name })}
    >
      <Show when={props.icon}>{props.icon}</Show>
      <Show when={props.text}>{props.text}</Show>
    </a>
  );
}

export interface NavbarProps {
  page: string;
  controls: AppControls;
}

export function Navbar(props: NavbarProps) {
  return (
    <nav class="header h-16 py-4 px-10 flex items-center justify-between py-4 px-10">
      <div class="flex gap-2 items-center">
        <NavbarLink
          name="home"
          text="Home"
          icon={<IconHouse size={16} />}
          page={props.page}
          controls={props.controls}
        />
        <NavbarLink
          name="files"
          text="Files"
          icon={<IconBook size={16} />}
          page={props.page}
          controls={props.controls}
        />
        <NavbarLink
          name="training"
          text="Training"
          icon={<IconTodo size={16} />}
          page={props.page}
          controls={props.controls}
        />
      </div>
      <div class="flex items-center gap-2">
        <Button
          style="flat"
          icon={
            props.controls.theme() == "light" ? (
              <IconSun class="text-yellow-500" />
            ) : (
              <IconMoon strokeWidth={1.5} fill="black" />
            )
          }
          onClick={() => {
            if (props.controls.theme() == "light") {
              props.controls.setTheme("dark");
            } else {
              props.controls.setTheme("light");
            }
          }}
        />
      </div>
    </nav>
  );
}
