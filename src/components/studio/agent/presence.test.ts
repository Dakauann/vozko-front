import { afterEach, describe, expect, it, vi } from "vitest";

import { createAgentPresence } from "./presence";

afterEach(() => {
  vi.useRealTimers();
});

describe("agent presence", () => {
  it("shows Elo where she works and hides her after a quiet moment", () => {
    vi.useFakeTimers();
    const presence = createAgentPresence(1000);
    presence.point({ x: 10, y: 20 }, "Cortando");
    expect(presence.store.getState()).toMatchObject({ visible: true, x: 10, y: 20, label: "Cortando" });
    presence.rest();
    vi.advanceTimersByTime(999);
    expect(presence.store.getState().visible).toBe(true);
    vi.advanceTimersByTime(1);
    expect(presence.store.getState().visible).toBe(false);
  });

  it("keeps the last position when a target cannot be found on screen", () => {
    const presence = createAgentPresence();
    presence.point({ x: 5, y: 6 }, "a");
    presence.point(null, "b");
    expect(presence.store.getState()).toMatchObject({ x: 5, y: 6, label: "b" });
  });

  it("does not hide while she is busy applying a step", () => {
    vi.useFakeTimers();
    const presence = createAgentPresence(1000);
    presence.point({ x: 1, y: 1 }, "a");
    presence.rest();
    presence.busy(true);
    vi.advanceTimersByTime(5000);
    expect(presence.store.getState()).toMatchObject({ visible: true, busy: true });
    expect(presence.isBusy()).toBe(true);
  });
});
