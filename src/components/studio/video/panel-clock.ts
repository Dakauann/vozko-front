import { createStore, type StoreApi } from "zustand/vanilla";

import type { VideoViewStore } from "./view-store";

export const PANEL_TICK_MS = 125;

export interface PanelClockState {
  playheadMs: number;
}

export type PanelClock = StoreApi<PanelClockState>;

export function createPanelClock(view: VideoViewStore): PanelClock {
  const clock = createStore<PanelClockState>()(() => ({ playheadMs: view.getState().playheadMs }));
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastTick = 0;

  const publish = () => {
    timer = null;
    lastTick = Date.now();
    const playheadMs = view.getState().playheadMs;
    if (clock.getState().playheadMs !== playheadMs) clock.setState({ playheadMs });
  };

  view.subscribe((state, previous) => {
    if (state.playheadMs === previous.playheadMs && state.playing === previous.playing) return;
    if (!state.playing) {
      if (timer !== null) clearTimeout(timer);
      publish();
      return;
    }
    const wait = PANEL_TICK_MS - (Date.now() - lastTick);
    if (wait <= 0) publish();
    else if (timer === null) timer = setTimeout(publish, wait);
  });

  return clock;
}
