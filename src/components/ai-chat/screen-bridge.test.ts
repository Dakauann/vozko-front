import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { endScreenTurn, revealOnScreen, useCanReveal, useScreenReveal, useScreenTurnEnd } from "./screen-bridge";

describe("screen turns", () => {
  it("tells open screens when Elo finishes a reply, until they close", () => {
    const listener = vi.fn();
    const { unmount } = renderHook(() => useScreenTurnEnd(listener));
    endScreenTurn();
    expect(listener).toHaveBeenCalledTimes(1);
    unmount();
    endScreenTurn();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("revealing what Elo looked at", () => {
  it("reaches only the editor of the project she looked at, while it is open", () => {
    const reveal = vi.fn();
    const editor = renderHook(() => useScreenReveal("p-1", reveal));
    const open = renderHook(() => useCanReveal("p-1"));
    const other = renderHook(() => useCanReveal("p-2"));
    expect(open.result.current).toBe(true);
    expect(other.result.current).toBe(false);
    expect(revealOnScreen({ kind: "moments", fromMs: 3000, toMs: 5000, projectId: "p-2" })).toBe(false);
    expect(reveal).not.toHaveBeenCalled();
    expect(revealOnScreen({ kind: "moments", fromMs: 3000, toMs: 5000, projectId: "p-1" })).toBe(true);
    expect(reveal).toHaveBeenCalledWith({ kind: "moments", fromMs: 3000, toMs: 5000, projectId: "p-1" });
    editor.unmount();
    open.rerender();
    expect(open.result.current).toBe(false);
    expect(revealOnScreen({ kind: "moments", fromMs: 0, toMs: 0, projectId: "p-1" })).toBe(false);
  });
});
