import { LibraryBrowser } from "./Library";
export { LibraryStorage } from "./storage";
import type { LibraryStorage } from "./storage";

interface LibraryProps {
  storage: LibraryStorage;
}

export function Library(props: LibraryProps) {
  return <LibraryBrowser storage={props.storage} />;
}
