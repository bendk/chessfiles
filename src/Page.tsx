import type { Training } from "~/lib/training";

/***
 * Argument for the `setPage` function
 */
export interface Page {
  name: string;
  initialPath?: string;
  initialTraining?: Training;
}
