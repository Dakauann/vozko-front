import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { endScreenTurn, useScreenTurnEnd } from "./screen-bridge";

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
