import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMinuteClock } from "./use-minute-clock";

describe("the shared minute clock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T12:00:30Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks on the minute boundary for every reader with one timer", () => {
    const first = renderHook(() => useMinuteClock());
    const second = renderHook(() => useMinuteClock());
    const timersWithTwoReaders = vi.getTimerCount();
    expect(timersWithTwoReaders).toBe(1);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(first.result.current).toBe(Date.parse("2026-10-18T12:01:00Z"));
    expect(second.result.current).toBe(first.result.current);
    first.unmount();
    second.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
