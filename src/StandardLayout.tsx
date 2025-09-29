import type { JSX } from "solid-js";
import { Navbar } from "~/components";

interface StandardLayoutProps {
  page: string;
  setPage: (page: string) => void;
  children: JSX.Element;
}

export function StandardLayout(props: StandardLayoutProps) {
  return (
    <div class="h-screen flex flex-col">
      <Navbar page={props.page} setPage={props.setPage} />
      <div class="min-h-0 overflow-auto pt-4 px-10 grow">{props.children}</div>
    </div>
  );
}
