export { Button } from "./Button";
export { Checkbox } from "./Checkbox";
export { Dialog } from "./Dialog";
export { Menu, MenuButton } from "./Menu";
export type { MenuItem } from "./Menu";
export { Progress } from "./Progress";
export * as RadioGroup from "./RadioGroup";
export { Navbar } from "./Navbar";
export { Slider } from "./Slider";
export { Status, StatusError, StatusTracker } from "./Status";
export { Table, TableCell, TableGripperCell, TableMenuCell } from "./Table";
export { Chooser } from "./library/Chooser";

import LoaderIcon from "lucide-solid/icons/loader-2";

export function Loader() {
  return (
    <div class="w-screen h-screen flex justify-center items-center">
      <LoaderIcon class="animate-spin duration-1000" size={64} />
    </div>
  );
}
