import Star from "lucide-solid/icons/star";
import { Match, Switch } from "solid-js";
import { TrainingRank } from "~/lib/training";

export interface TrainingRankIconProps {
  rank: number;
}

export function TrainingRankIcon(props: TrainingRankIconProps) {
  return (
    <Switch>
      <Match when={props.rank == TrainingRank.Silver1}>
        <div class="flex" title="Silver 1">
          <Star class="fill-zinc-200 stroke-zinc-200" />
        </div>
      </Match>
      <Match when={props.rank == TrainingRank.Silver2}>
        <div class="flex" title="Silver 2">
          <Star class="fill-zinc-200 stroke-zinc-200" />
          <Star class="fill-zinc-200 stroke-zinc-200" />
        </div>
      </Match>
      <Match when={props.rank == TrainingRank.Silver3}>
        <div class="flex" title="Silver 3">
          <Star class="fill-zinc-200 stroke-zinc-200" />
          <Star class="fill-zinc-200 stroke-zinc-200" />
          <Star class="fill-zinc-200 stroke-zinc-200" />
        </div>
      </Match>
      <Match when={props.rank == TrainingRank.Silver4}>
        <div class="flex" title="Silver 4">
          <Star class="fill-zinc-200 stroke-zinc-200" />
          <Star class="fill-zinc-200 stroke-zinc-200" />
          <Star class="fill-zinc-200 stroke-zinc-200" />
          <Star class="fill-zinc-200 stroke-zinc-200" />
        </div>
      </Match>

      <Match when={props.rank == TrainingRank.Gold1}>
        <div class="flex" title="Gold 1">
          <Star class="fill-amber-400 stroke-amber-400" />
        </div>
      </Match>
      <Match when={props.rank == TrainingRank.Gold2}>
        <div class="flex" title="Gold 2">
          <Star class="fill-amber-400 stroke-amber-400" />
          <Star class="fill-amber-400 stroke-amber-400" />
        </div>
      </Match>
      <Match when={props.rank == TrainingRank.Gold3}>
        <div class="flex" title="Gold 3">
          <Star class="fill-amber-400 stroke-amber-400" />
          <Star class="fill-amber-400 stroke-amber-400" />
          <Star class="fill-amber-400 stroke-amber-400" />
        </div>
      </Match>
      <Match when={props.rank == TrainingRank.Gold4}>
        <div class="flex" title="Gold 4">
          <Star class="fill-amber-400 stroke-amber-400" />
          <Star class="fill-amber-400 stroke-amber-400" />
          <Star class="fill-amber-400 stroke-amber-400" />
          <Star class="fill-amber-400 stroke-amber-400" />
        </div>
      </Match>

      <Match when={props.rank == TrainingRank.Diamond1}>
        <div class="flex" title="Diamond 1">
          <Star class="fill-cyan-200 stroke-cyan-200" />
        </div>
      </Match>
      <Match when={props.rank == TrainingRank.Diamond2}>
        <div class="flex" title="Diamond 2">
          <Star class="fill-cyan-200 stroke-cyan-200" />
          <Star class="fill-cyan-200 stroke-cyan-200" />
        </div>
      </Match>
      <Match when={props.rank == TrainingRank.Diamond3}>
        <div class="flex" title="Diamond 3">
          <Star class="fill-cyan-200 stroke-cyan-200" />
          <Star class="fill-cyan-200 stroke-cyan-200" />
          <Star class="fill-cyan-200 stroke-cyan-200" />
        </div>
      </Match>
      <Match when={props.rank == TrainingRank.Diamond4}>
        <div class="flex" title="Diamond 4">
          <Star class="fill-cyan-200 stroke-cyan-200" />
          <Star class="fill-cyan-200 stroke-cyan-200" />
          <Star class="fill-cyan-200 stroke-cyan-200" />
          <Star class="fill-cyan-200 stroke-cyan-200" />
        </div>
      </Match>
    </Switch>
  );
}
