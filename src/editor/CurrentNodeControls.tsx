import SquarePlus from "lucide-solid/icons/square-plus";
import Tags from "lucide-solid/icons/tags";
import Trash from "lucide-solid/icons/trash-2";
import { Nag, nagText } from "~/lib/chess";
import type { EditorCurrentNode } from "~/lib/editor";
import { Index, Show } from "solid-js";
import { Button } from "../Button";
import { Menu } from "../Menu";

export interface CurrentNodeControlsProps {
  isRoot: boolean;
  currentNode: EditorCurrentNode;
  setDraftComment: (comment: string) => void;
  commitDraftComment: () => void;
  toggleNag: (nag: Nag) => void;
  deleteLine: () => void;
  addLine: () => void;
}

export function CurrentNodeControls(props: CurrentNodeControlsProps) {
  const item = (nag: Nag, cssClass?: string) => ({
    text: nagText(nag),
    value: nag.toString(),
    selected: props.currentNode.nags.indexOf(nag) != -1,
    cssClass,
  });

  return (
    <Show
      when={!props.currentNode.isDraft}
      fallback={
        <Button text="Add Line" icon={<SquarePlus />} onClick={props.addLine} />
      }
    >
      <textarea
        class="border-1 border-zinc-400 dark-border-zinc-500 rounded-sm w-full p-2"
        value={props.currentNode.comment}
        onInput={(evt) => props.setDraftComment(evt.target.value)}
        onChange={props.commitDraftComment}
        placeholder="add comment"
        rows="3"
      ></textarea>
      <Show when={!props.isRoot}>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Menu
              top
              style="nags"
              elt={<Button icon=<Tags /> />}
              items={[
                item(Nag.BrilliantMove, "row-start-2"),
                item(Nag.GoodMove),
                item(Nag.InterestingMove),
                item(Nag.DubiousMove),
                item(Nag.PoorMove),
                item(Nag.BlunderMove),

                item(Nag.PlusOverMinusPosition, "row-start-1"),
                item(Nag.PlusMinusPosition),
                item(Nag.PlusEqualsPosition),
                item(Nag.EqualPosition),
                item(Nag.UnclearPosition),
                item(Nag.EqualsPlusPosition),
                item(Nag.MinusPlusPosition),
                item(Nag.MinusOverPlusPosition),
              ]}
              onSelect={(nag) => props.toggleNag(Number.parseInt(nag))}
            />
            <div>
              <Index each={props.currentNode.nags}>
                {(nag) => (
                  <span class="text-lg px-2 bg-slate-300 dark:bg-slate-700 rounded-sm mr-2">
                    {nagText(nag())}
                  </span>
                )}
              </Index>
            </div>
          </div>
          <Button icon={<Trash />} onClick={props.deleteLine} />
        </div>
      </Show>
    </Show>
  );
}
