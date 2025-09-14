import { v4 as uuidv4 } from "uuid";

// Activity record from a single training session
export interface TrainingActivity {
  id: string;
  name: string;
  timestamp: number;
  linesTrained: number;
  correctCount: number;
  incorrectCount: number;
}

export function newTrainingActivity(name: string): TrainingActivity {
  return {
    name,
    id: uuidv4(),
    timestamp: Date.now(),
    linesTrained: 0,
    correctCount: 0,
    incorrectCount: 0,
  };
}
