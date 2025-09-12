import { v4 as uuidv4 } from "uuid";

// Activity record from a single training session
export interface TrainingActivity {
  type: "training";
  id: string;
  name: string;
  timestamp: number;
  correctCount: number;
  incorrectCount: number;
}

export function newTrainingActivity(name: string): TrainingActivity {
  return {
    type: "training",
    name,
    id: uuidv4(),
    timestamp: Date.now(),
    correctCount: 0,
    incorrectCount: 0,
  };
}

export type Activity = TrainingActivity;
