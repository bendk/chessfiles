// Activity record from a single training session
export interface TrainingActivity {
  bookId: string;
  timestamp: number;
  correctCount: number;
  incorrectCount: number;
}

export function newTrainingActivity(bookId: string): TrainingActivity {
  return {
    timestamp: Date.now(),
    bookId,
    correctCount: 0,
    incorrectCount: 0,
  };
}

export type Activity = TrainingActivity;
