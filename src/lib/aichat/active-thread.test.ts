import { afterEach, describe, expect, it, vi } from "vitest";

import { activeThreadKey, forgetActiveThread, readActiveThread, rememberActiveThread } from "./active-thread";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("active thread memory", () => {
  it("is kept per workspace", () => {
    rememberActiveThread(activeThreadKey("ws-1"), "t-1");
    expect(readActiveThread(activeThreadKey("ws-1"))).toBe("t-1");
    expect(readActiveThread(activeThreadKey("ws-2"))).toBeNull();
    forgetActiveThread(activeThreadKey("ws-1"));
    expect(readActiveThread(activeThreadKey("ws-1"))).toBeNull();
  });

  it("never breaks the chat when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => rememberActiveThread("k", "t-1")).not.toThrow();
    expect(readActiveThread("k")).toBeNull();
  });
});
