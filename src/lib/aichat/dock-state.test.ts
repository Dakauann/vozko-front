import { beforeEach, describe, expect, it, vi } from "vitest";

import { isDockOpen, setDockOpen, subscribeDock } from "./dock-state";

describe("dock state", () => {
  beforeEach(() => sessionStorage.clear());

  it("starts closed and remembers when it is opened", () => {
    expect(isDockOpen()).toBe(false);
    setDockOpen(true);
    expect(isDockOpen()).toBe(true);
    setDockOpen(false);
    expect(isDockOpen()).toBe(false);
  });

  it("tells every listener when it changes, so a navigation can hand the chat to the dock", () => {
    const listener = vi.fn();
    const stop = subscribeDock(listener);
    setDockOpen(true);
    stop();
    setDockOpen(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
