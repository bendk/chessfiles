import type { JSXElement } from "solid-js";

interface NavbarProps {
  children: JSXElement;
  class?: string;
}

export function Navbar(props: NavbarProps) {
  return (
    <nav
      class={`text-zinc-200 bg-zinc-800 dark:bg-slate-800 dark:text-zinc-300 h-16 py-4 px-10 ${props.class}`}
    >
      {props.children}
    </nav>
  );
}
