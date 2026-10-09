import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPanelClock, PANEL_TICK_MS } from "./panel-clock";
import { createVideoViewStore } from "./view-store";

describe("panel clock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("follows every playhead move while paused", () => {
    const view = createVideoViewStore();
    const clock = createPanelClock(view);
    view.setState({ playheadMs: 1200 });
    view.setState({ playheadMs: 1250 });
    expect(clock.getState().playheadMs).toBe(1250);
  });

  it("updates panels a few times a second while playing and lands on the last frame", () => {
    const view = createVideoViewStore();
    const clock = createPanelClock(view);
    const seen: number[] = [];
    clock.subscribe((state) => seen.push(state.playheadMs));
    view.setState({ playing: true });
    for (let ms = 16; ms <= 160; ms += 16) {
      vi.advanceTimersByTime(16);
      view.setState({ playheadMs: ms });
    }
    expect(seen.length).toBeLessThanOrEqual(3);
    vi.advanceTimersByTime(PANEL_TICK_MS);
    expect(clock.getState().playheadMs).toBe(160);
  });

  it("catches up at once when playback stops", () => {
    const view = createVideoViewStore();
    const clock = createPanelClock(view);
    view.setState({ playing: true });
    view.setState({ playheadMs: 40 });
    view.setState({ playheadMs: 80 });
    view.setState({ playing: false, playheadMs: 90 });
    expect(clock.getState().playheadMs).toBe(90);
  });
});
