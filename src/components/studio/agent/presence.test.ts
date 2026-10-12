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

  it("marks the moments she looks at and clears them with the rest of her trace", () => {
    vi.useFakeTimers();
    const presence = createAgentPresence(1000);
    const tick = { left: 40, top: 300, width: 2, height: 120 };
    presence.point({ x: 1, y: 1 }, "Vendo", null, [tick]);
    expect(presence.store.getState().ticks).toEqual([tick]);
    presence.point({ x: 2, y: 2 }, "Cortando");
    expect(presence.store.getState().ticks).toEqual([]);
    presence.point({ x: 1, y: 1 }, "Vendo", null, [tick]);
    presence.rest();
    vi.advanceTimersByTime(1000);
    expect(presence.store.getState()).toMatchObject({ visible: false, ticks: [] });
  });

  it("keeps the pictures she saw apart from her cursor", () => {
    const presence = createAgentPresence();
    presence.shots.add("data:image/jpeg;base64,AA", { kind: "artboards" });
    presence.rest();
    expect(presence.shots.store.getState().shots).toHaveLength(1);
  });

  it("does not hide while she is busy applying a step", () => {
    vi.useFakeTimers();
    const presence = createAgentPresence(1000);
    presence.point({ x: 1, y: 1 }, "a");
    presence.rest();
    presence.busy(true);
    vi.advanceTimersByTime(5000);
    expect(presence.store.getState()).toMatchObject({ visible: true, busy: true });
    expect(presence.store.getState().busy).toBe(true);
  });
});
