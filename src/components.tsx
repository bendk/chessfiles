export { Button } from "./Button";
export { Checkbox } from "./Checkbox";
export { Dialog } from "./Dialog";
export { StandardLayout } from "./StandardLayout";
export { Home } from "./Home";
export {
  contextMenuEventHandlers,
  menuHeader,
  menuItem,
  menuSeparator,
  Menu,
  MenuButton,
  MenuContextTrigger,
  MenuTrigger,
} from "./Menu";
export type { MenuContext, MenuItem } from "./Menu";
export { Progress } from "./Progress";
export * as RadioGroup from "./RadioGroup";
export { Navbar } from "./Navbar";
export { Slider } from "./Slider";
export { Status, StatusError, StatusTracker } from "./Status";
export { Table, TableCell, TableGripperCell, TableMenuCell } from "./Table";
export { ToggleSwitch } from "./ToggleSwitch";
export { ChooserDialog } from "./library/ChooserDialog";
export type { AppControls, Page } from "./App";

import LoaderIcon from "lucide-solid/icons/loader-2";

export function Loader() {
  return (
    <div class="w-screen h-screen flex justify-center items-center">
      <LoaderIcon class="animate-spin duration-1000" size={64} />
    </div>
  );
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
