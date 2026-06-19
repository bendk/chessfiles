import { v4 as uuidv4 } from "uuid";

export type Activity = TrainingActivity | LibraryActivity;

// Activity record from editing a library file
export interface LibraryActivity {
  type: "library";
  id: string;
  filename: string;
  timestamp: number;
}

// Activity record from a single training session
export interface TrainingActivity {
  type: "training";
  id: string;
  name: string;
  timestamp: number;
  linesTrained: number;
  correctCount: number;
  incorrectCount: number;
}

export function newLibraryActivity(
  filename: string,
  timestamp?: number,
): LibraryActivity {
  return {
    type: "library",
    id: uuidv4(),
    filename,
    timestamp: timestamp ?? Date.now(),
  };
}

export function newTrainingActivity(
  name: string,
  timestamp?: number,
): TrainingActivity {
  return {
    type: "training",
    name,
    id: uuidv4(),
    timestamp: timestamp ?? Date.now(),
    linesTrained: 0,
    correctCount: 0,
    incorrectCount: 0,
  };
}

export function activityDescription(a: Activity): string {
  if (a.type == "library") {
    return `Edited ${a.filename}`;
  } else if (a.type == "training") {
    return `Trained ${a.name}`;
  }
  return "<unknown>";
}
