interface EditorProps {
  onSave: (content: string) => void;
  onExit: () => void;
}

export function Editor(props: EditorProps) {
  return (
    <>
      <button onClick={() => props.onSave("SAVED")}>SAVE</button>
      <button onClick={() => props.onExit()}>Exit</button>
    </>
  );
}
