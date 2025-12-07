import { createEffect, createSignal, onCleanup, Index, Show } from "solid-js";
import Cpu from "lucide-solid/icons/cpu";
import ListTree from "lucide-solid/icons/list-tree";

import type { Chess, Move } from "~/lib/chess";
import { makeSanAndPlay } from "~/lib/chess";
import type { EngineSettings } from "~/lib/engine";
import {
  getEngineSettings,
  setEngineSettings,
  Engine as EngineBackend,
} from "~/lib/engine";
import type { MenuItem } from "~/components";
import { MenuButton, ToggleSwitch } from "~/components";

interface Line {
  score: string;
  moves: string[];
  firstMove: Move;
}

export interface EngineProps {
  currentPly: number;
  position: Chess;
  onMove: (move: Move) => void;
}

export function Engine(props: EngineProps) {
  const engine = EngineBackend.get();

  const [settings, setSettings] = createSignal(getEngineSettings());
  const [lines, setLines] = createSignal<Line[]>([]);
  const [nps, setNps] = createSignal("");
  const [nodes, setNodes] = createSignal("");

  function updateSettings(settings: EngineSettings) {
    setSettings(settings);
    setEngineSettings(settings);
  }

  engine.setMaxDepth(14);
  engine.setObserver((analysis) => {
    setNodes(nodeText(analysis.nodes));
    setNps(nodeText(analysis.nps));
    // Sometimes stockfish sends us more lines than requested, probably because they're already
    // cached.
    const trimmedLines = analysis.lines.slice(0, settings().lines);

    setLines(
      trimmedLines.map((line) => {
        let score;
        if (line.scoreType == "mate") {
          score = `#{line.score}`;
        } else {
          score = `${line.score >= 0 ? "+" : "-"}${(line.score / 100).toFixed(2)}`;
        }
        const position = props.position.clone();
        const moves = line.moves.map((m, index) => {
          const san = makeSanAndPlay(position, m);
          const ply = props.currentPly + index;
          if (index == 0 || ply % 2 == 0) {
            return `${1 + Math.floor(ply / 2)}${ply % 2 == 0 ? "." : "\u2026"} ${san}`;
          } else {
            return san;
          }
        });
        return {
          score,
          moves,
          firstMove: line.moves[0],
        };
      }),
    );
  });

  function nodeText(count: number) {
    if (count < 1_000) {
      return count.toString();
    } else if (count < 1_000_000) {
      return `${(count / 1_000).toFixed(1)}k`;
    } else if (count < 1_000_000_000) {
      return `${(count / 1_000_000).toFixed(1)}m`;
    } else {
      return `${(count / 1_000_000_000).toFixed(1)}g`;
    }
  }

  // Update the engine search/position based on the settings and current position
  createEffect(() => {
    const s = settings();
    if (s.enable) {
      localStorage.setItem("engine-enabled", "yes");
      engine.setSearchLines(s.lines);
      engine.setMaxDepth(s.maxDepth);
      engine.search(props.position);
    } else {
      engine.stop();
      localStorage.setItem("engine-enabled", "no");
    }
  });

  onCleanup(() => {
    engine.stop();
    engine.setObserver(null);
  });

  function depthMenuItems(): MenuItem[] {
    const s = settings();
    const items: MenuItem[] = [
      {
        text: "Max depth",
        value: "",
        disabled: true,
      },
    ];
    for (let i = 16; i <= 30; i++) {
      items.push({
        value: i.toString(),
        text: i.toString(),
        selected: s.maxDepth == i,
      });
    }

    items.push({
      value: "infinite",
      text: "Unlimited",
      selected: s.maxDepth === null,
    });

    return items;
  }

  function updateDepth(value: string) {
    if (value == "infinite") {
      updateSettings({ ...settings(), maxDepth: null });
    } else {
      const parsed = parseInt(value);
      if (!isNaN(parsed)) {
        updateSettings({ ...settings(), maxDepth: parsed });
      }
    }
  }

  function searchLinesItems(): MenuItem[] {
    const items: MenuItem[] = [
      {
        text: "Lines to display",
        value: "",
        disabled: true,
      },
    ];
    for (let i = 1; i <= 5; i++) {
      items.push({
        text: i.toString(),
        value: i.toString(),
        selected: settings().lines == i,
      });
    }
    return items;
  }

  function updateSearchLines(value: string) {
    updateSettings({ ...settings(), lines: parseInt(value) });
  }

  return (
    <div class="flex flex-col">
      <div class="flex items-center justify-between pb-1">
        <div class="flex items-center gap-2">
          <ToggleSwitch
            checked={settings().enable}
            onChange={(checked) =>
              updateSettings({ ...settings(), enable: checked })
            }
          />
          <h3 class="text-xl">Engine</h3>
        </div>
        <Show when={settings().enable}>
          <div class="flex items-center">
            <MenuButton
              style="flat"
              icon={<ListTree size={18} />}
              items={searchLinesItems()}
              onSelect={updateSearchLines}
            />
            <MenuButton
              style="flat"
              icon={<Cpu size={18} />}
              items={depthMenuItems()}
              onSelect={updateDepth}
            />
          </div>
        </Show>
      </div>
      <div>
        <div class="grid grid-cols-[auto_1fr] text-sm">
          <Index each={lines()}>
            {(line) => (
              <>
                <div class="py-0.5 pr-4 border-t-1 border-fg-3">
                  {line().score}
                </div>
                <button
                  class="py-0.5 border-t-1 border-fg-3 group cursor-pointer truncate"
                  onClick={() => props.onMove(line().firstMove)}
                >
                  <Index each={line().moves}>
                    {(move, index) => (
                      <span
                        classList={{
                          "group-hover:text-highlight-1": index == 0,
                        }}
                      >
                        {move() + " "}
                      </span>
                    )}
                  </Index>
                </button>
              </>
            )}
          </Index>
          <Show when={settings().enable}>
            <div class="border-t-1 border-fg-3 col-span-full flex justify-between">
              <div>nodes searched: {nodes()}</div>
              <div>nps: {nps()}</div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
