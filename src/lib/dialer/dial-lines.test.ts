import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { pickTrunk, readRememberedTrunk, rememberTrunk, useRememberedTrunk } from "@/lib/dialer/dial-lines";
import type { DialTrunk } from "@/lib/dialer/dial-targets";

function trunk(id: string): DialTrunk {
  return { id, name: id };
}

describe("pickTrunk", () => {
  const dialable = [trunk("a"), trunk("b"), trunk("c")];
  const cases = [
    { name: "the line the member chose", chosen: "c", remembered: "b", want: "c" },
    { name: "the remembered line when nothing was chosen", chosen: null, remembered: "b", want: "b" },
    { name: "the remembered line when the chosen one is gone", chosen: "gone", remembered: "b", want: "b" },
    { name: "the first line when neither is available", chosen: "gone", remembered: "gone", want: "a" },
    { name: "the first line with no history", chosen: null, remembered: null, want: "a" },
  ];

  for (const { name, chosen, remembered, want } of cases) {
    it(`picks ${name}`, () => {
      expect(pickTrunk(dialable, chosen, remembered)?.id).toBe(want);
    });
  }

  it("picks nothing when no line can dial", () => {
    expect(pickTrunk([], "a", "a")).toBeNull();
  });
});

describe("remembered line", () => {
  it("is kept per workspace under the dialer key", () => {
    window.localStorage.clear();
    rememberTrunk("ws-1", "b");
    expect(window.localStorage.getItem("dialer:trunk:ws-1")).toBe("b");
    expect(readRememberedTrunk("ws-1")).toBe("b");
    expect(readRememberedTrunk("ws-2")).toBeNull();
    window.localStorage.clear();
  });

  it("reaches every reader at once when a line is chosen anywhere", () => {
    window.localStorage.clear();
    const first = renderHook(() => useRememberedTrunk("ws-1"));
    const second = renderHook(() => useRememberedTrunk("ws-1"));
    const other = renderHook(() => useRememberedTrunk("ws-2"));
    expect(first.result.current).toBeNull();

    act(() => rememberTrunk("ws-1", "b"));
    expect(first.result.current).toBe("b");
    expect(second.result.current).toBe("b");
    expect(other.result.current).toBeNull();
    window.localStorage.clear();
  });

  it("follows a line chosen in another tab", () => {
    window.localStorage.clear();
    const hook = renderHook(() => useRememberedTrunk("ws-1"));
    act(() => {
      window.localStorage.setItem("dialer:trunk:ws-1", "c");
      window.dispatchEvent(new StorageEvent("storage", { key: "dialer:trunk:ws-1", newValue: "c" }));
    });
    expect(hook.result.current).toBe("c");
    window.localStorage.clear();
  });

  it("keeps the choice for the page when the browser refuses storage", () => {
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const refused = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const hook = renderHook(() => useRememberedTrunk("ws-9"));
    act(() => rememberTrunk("ws-9", "a"));
    expect(readRememberedTrunk("ws-9")).toBe("a");
    expect(hook.result.current).toBe("a");
    blocked.mockRestore();
    refused.mockRestore();
  });
});
