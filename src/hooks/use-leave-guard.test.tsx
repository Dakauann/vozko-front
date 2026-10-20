import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLeaveGuard } from "./use-leave-guard";

function leaving(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("useLeaveGuard", () => {
  it("asks the browser to confirm leaving only while there is something to lose", () => {
    const { rerender, unmount } = renderHook(({ active }) => useLeaveGuard(active), { initialProps: { active: false } });
    expect(leaving()).toBe(false);
    rerender({ active: true });
    expect(leaving()).toBe(true);
    rerender({ active: false });
    expect(leaving()).toBe(false);
    rerender({ active: true });
    unmount();
    expect(leaving()).toBe(false);
  });
});
