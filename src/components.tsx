export { AppContext } from "./App";
export { Button } from "./Button";
export { Dialog } from "./Dialog";
export { Layout } from "./Layout";
export { Menu, MenuButton } from "./Menu";
export type { MenuItem } from "./Menu";
export { Navbar } from "./Navbar";
export { Progress } from "./Progress";
export * as RadioGroup from "./RadioGroup";
export { StandardNavbar } from "./StandardNavbar";
export { Table, TableCell, TableMenuCell } from "./Table";
export { StatusTracker } from "./lib/status";
export { Chooser } from "./library/Chooser";

import LoaderIcon from "lucide-solid/icons/loader-2";

export function Loader() {
  return (
    <div class="w-screen h-screen flex justify-center items-center">
      <LoaderIcon class="animate-spin duration-1000" size={64} />
    </div>
  );
}
