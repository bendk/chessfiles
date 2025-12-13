import BookIcon from "lucide-solid/icons/book";
import {
  createEffect,
  createMemo,
  createSignal,
  Index,
  Match,
  Show,
  Switch,
} from "solid-js";

import type { Chess, Move } from "~/lib/chess";
import { abbreviateCount } from "~/lib/util";
import type { OpeningBookSettings, OpeningBookLookup } from "~/lib/openingBook";
import type { TablebaseSettings, TablebaseLookup } from "~/lib/tablebase";
import {
  getOpeningBookSettings,
  isOpeningBookKind,
  setOpeningBookSettings,
  openingBookLabel,
  lookupOpeningPosition,
  ALL_OPENING_BOOK_KINDS,
} from "~/lib/openingBook";
import {
  getTablebaseSettings,
  setTablebaseSettings,
  lookupTablebasePosition,
} from "~/lib/tablebase";
import type { MenuItem } from "~/components";
import { MenuButton, ToggleSwitch } from "~/components";

export interface BookProps {
  position: Chess;
  onMove: (move: Move) => void;
}

export function Book(props: BookProps) {
  const pieceCount = createMemo(
    () =>
      props.position.board["white"].size() +
      props.position.board["black"].size(),
  );

  return (
    <Switch>
      <Match when={pieceCount() <= 8}>
        <Tablebase {...props} />
      </Match>
      <Match when={true}>
        <OpeningBook {...props} />
      </Match>
    </Switch>
  );
}

export function OpeningBook(props: BookProps) {
  const [settings, setSettings] = createSignal(getOpeningBookSettings());
  const [lookup, setLookup] = createSignal<OpeningBookLookup | null>(null);

  function updateSettings(settings: OpeningBookSettings) {
    setSettings(settings);
    setOpeningBookSettings(settings);
  }

  function openingBookKindMenuItems(): MenuItem[] {
    const s = settings();
    return ALL_OPENING_BOOK_KINDS.map((kind) => ({
      text: openingBookLabel(kind),
      value: kind,
      selected: s.kind == kind,
    }));
  }

  function updateOpeningBookKind(value: string) {
    if (isOpeningBookKind(value)) {
      updateSettings({ ...settings(), kind: value });
    }
  }

  createEffect(async () => {
    setLookup(null);
    setLookup(await lookupOpeningPosition(settings().kind, props.position));
  });

  return (
    <div class="flex flex-col grow">
      <div class="flex items-center justify-between pb-1">
        <h3 class="flex items-center gap-2">
          <ToggleSwitch
            checked={settings().enable}
            onChange={(checked) =>
              updateSettings({ ...settings(), enable: checked })
            }
          />
          {openingBookLabel(settings().kind)}
        </h3>
        <MenuButton
          style="flat"
          icon={<BookIcon size={18} />}
          items={openingBookKindMenuItems()}
          onSelect={updateOpeningBookKind}
        />
      </div>
      <Show when={settings().enable}>
        <Show when={lookup()} keyed>
          {(lookup) => (
            <Show when={lookup.gameCount > 0}>
              <div class="grid grid-cols-[auto_auto_auto_1fr] text-sm">
                <Index each={lookup.moves}>
                  {(move) => (
                    <button
                      class="grid grid-cols-subgrid col-span-4 group cursor-pointer text-left"
                      onClick={() => props.onMove(move().move)}
                    >
                      <div class="pr-4 border-t-1 border-fg-3 group-hover:text-highlight-1">
                        {move().san}
                      </div>
                      <div class="pr-4 border-t-1 border-fg-3">
                        {move().gamePercent}
                      </div>
                      <div class="pr-4 border-t-1 border-fg-3">
                        {abbreviateCount(move().gameCount)}
                      </div>
                      <div class="border-t-1 border-fg-3 flex text-xs">
                        <div
                          class="bg-gray-100 text-black text-center basis-0 min-w-0 text-clip"
                          style={`flex-grow: ${move().whiteWinCount}`}
                        >
                          <Show when={move().whiteWinRatio > 0.2}>
                            {(
                              (move().whiteWinCount * 100) /
                              move().gameCount
                            ).toFixed(1)}
                            %
                          </Show>
                        </div>
                        <div
                          class="bg-gray-500 text-black text-center basis-0 min-w-0 text-clip"
                          style={`flex-grow: ${move().drawCount}`}
                        >
                          <Show when={move().drawRatio > 0.2}>
                            {(
                              (move().drawCount * 100) /
                              move().gameCount
                            ).toFixed(1)}
                            %
                          </Show>
                        </div>
                        <div
                          class="bg-gray-800 text-gray-200 text-center basis-0 min-w-0 text-clip"
                          style={`flex-grow: ${move().blackWinCount}`}
                        >
                          <Show when={move().blackWinRatio > 0.2}>
                            {(
                              (move().blackWinCount * 100) /
                              move().gameCount
                            ).toFixed(1)}
                            %
                          </Show>
                        </div>
                      </div>
                    </button>
                  )}
                </Index>
                <div class="pt-1 border-t-1 border-fg-3 col-span-full">
                  Total games: {abbreviateCount(lookup.gameCount)}
                </div>
              </div>
              <Show when={lookup.topGames.length > 0}>
                <h3 class="pt-4 pb-1 text-fg-2">Top games</h3>
                <div class="overflow-auto grid grid-cols-[auto_1fr_auto_auto_auto] text-sm basis-0 grow">
                  <Index each={lookup.topGames}>
                    {(item) => (
                      <a
                        class="grid grid-cols-subgrid col-span-full text-left cursor-pointer hover:bg-highlight-2"
                        href={item().url}
                        target="_blank"
                      >
                        <div class="pt-1 pr-2 border-t-1 border-fg-3">
                          {item().white.rating}
                        </div>
                        <div class="pt-1 pr-2 border-t-1 border-fg-3 truncate">
                          {item().white.name}
                        </div>
                        <div class="pt-1 pr-2 border-t-1 border-fg-3 row-span-2 pb-2 flex items-center">
                          {item().san}
                        </div>
                        <div class="pt-1 pr-2 border-t-1 border-fg-3 row-span-2 pb-2 flex items-center">
                          <Switch>
                            <Match when={item().winner == "white"}>1-0</Match>
                            <Match when={item().winner == "black"}>0-1</Match>
                            <Match when={item().winner === null}>
                              &#x00BD-&#x00BD
                            </Match>
                          </Switch>
                        </div>
                        <div class="pt-1 border-t-1 border-fg-3 row-span-2 pb-2 flex items-center">
                          {item().year}
                        </div>

                        <div class="pb-2">{item().black.rating}</div>
                        <div class="truncate pb-2">{item().black.name}</div>
                      </a>
                    )}
                  </Index>
                </div>
              </Show>
            </Show>
          )}
        </Show>
      </Show>
    </div>
  );
}

export function Tablebase(props: BookProps) {
  const [settings, setSettings] = createSignal(getTablebaseSettings());
  const [lookup, setLookup] = createSignal<TablebaseLookup | null>(null);

  function updateSettings(settings: TablebaseSettings) {
    setSettings(settings);
    setTablebaseSettings(settings);
  }

  createEffect(async () => {
    setLookup(null);
    setLookup(await lookupTablebasePosition(settings().kind, props.position));
  });

  const dtzTooltip =
    "Rounded distance to Zeroing under the 50-move rule: The number of half-moves until the next capture, pawn move, or checkmate";
  const dtmTooltip = "Depth to mate: The number of half-moves until mate";

  return (
    <div class="flex flex-col">
      <h3 class="flex items-center gap-2">
        <ToggleSwitch
          checked={settings().enable}
          onChange={(checked) =>
            updateSettings({ ...settings(), enable: checked })
          }
        />
        Lichess Tablebase
      </h3>
      <Show when={settings().enable}>
        <Show when={lookup()} keyed>
          {(lookup) => (
            <div class="mt-1 grid grid-cols-[1fr_auto_auto] text-sm gap-x-2 gap-y-2">
              <Show when={lookup.winningMoves.length > 0}>
                <div class="grid grid-cols-subgrid gap-y-1 col-span-full">
                  <h3 class="py-1 px-2 rounded-sm col-span-full bg-bg-3">
                    Winning
                  </h3>
                  <Index each={lookup.winningMoves}>
                    {(item) => (
                      <>
                        <button
                          class="cursor-pointer text-left hover:text-highlight-1 text-left"
                          onClick={() => props.onMove(item().move)}
                        >
                          {item().san}
                        </button>
                        <div
                          class="bg-bg-2 px-2 py-0.5 rounded-sm"
                          title={dtzTooltip}
                        >
                          DTZ {item().dtz}
                        </div>
                        <div
                          class="bg-bg-2 px-2 py-0.5 rounded-sm"
                          title={dtmTooltip}
                        >
                          DTM {item().dtm}
                        </div>
                      </>
                    )}
                  </Index>
                </div>
              </Show>
              <Show when={lookup.drawingMoves.length > 0}>
                <div class="grid grid-cols-subgrid gap-y-1 col-span-3">
                  <h3 class="py-1 px-2 rounded-sm col-span-full bg-bg-3">
                    Drawing
                  </h3>
                  <Index each={lookup.drawingMoves}>
                    {(item) => (
                      <>
                        <button
                          class="cursor-pointer text-left hover:text-highlight-1"
                          onClick={() => props.onMove(item().move)}
                        >
                          {item().san}
                        </button>
                        <div class="col-span-2"></div>
                      </>
                    )}
                  </Index>
                </div>
              </Show>
              <Show when={lookup.losingMoves.length > 0}>
                <div class="grid grid-cols-subgrid gap-y-1 col-span-3">
                  <h3 class="py-1 px-2 rounded-sm col-span-full bg-bg-3">
                    Losing
                  </h3>
                  <Index each={lookup.losingMoves}>
                    {(item) => (
                      <>
                        <button
                          class="cursor-pointer text-left hover:text-highlight-1"
                          onClick={() => props.onMove(item().move)}
                        >
                          {item().san}
                        </button>
                        <div
                          class="bg-bg-2 px-2 py-0.5 rounded-sm"
                          title={dtzTooltip}
                        >
                          DTZ {item().dtz}
                        </div>
                        <div
                          class="bg-bg-2 px-2 py-0.5 rounded-sm"
                          title={dtmTooltip}
                        >
                          DTM {item().dtm}
                        </div>
                      </>
                    )}
                  </Index>
                </div>
              </Show>
              <Show when={lookup.unknownMoves.length > 0}>
                <div class="grid grid-cols-subgrid gap-y-1 col-span-3">
                  <h3 class="py-1 px-2 rounded-sm col-span-full bg-bg-3">
                    Unknown
                  </h3>
                  <Index each={lookup.unknownMoves}>
                    {(item) => (
                      <>
                        <button
                          class="cursor-pointer text-left hover:text-highlight-1"
                          onClick={() => props.onMove(item().move)}
                        >
                          {item().san}
                        </button>
                        <div class="col-span-2"></div>
                      </>
                    )}
                  </Index>
                </div>
              </Show>
            </div>
          )}
        </Show>
      </Show>
    </div>
  );
}
