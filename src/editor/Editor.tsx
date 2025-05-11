import { Board } from "./Board";
import { INITIAL_FEN } from "~/lib/chess";

interface EditorProps {
  onSave: (content: string) => void;
  onExit: () => void;
}

export function Editor(props: EditorProps) {
  return (
    <>
      <div class="w-200 h-200">
        <Board fen={INITIAL_FEN} />
      </div>
      <button onClick={() => props.onSave("SAVED")}>SAVE</button>
      <button onClick={() => props.onExit()}>Exit</button>
    </>
  );
}
