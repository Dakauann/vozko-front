import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HOVER_INTENT_MS, useHoverIntent } from "./use-hover-intent";

describe("useHoverIntent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires once the pointer has rested on a row for 150 ms", () => {
    const onIntent = vi.fn();
    const { result } = renderHook(() => useHoverIntent(onIntent));

    act(() => result.current.start("e1"));
    act(() => vi.advanceTimersByTime(HOVER_INTENT_MS - 1));
    expect(onIntent).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onIntent).toHaveBeenCalledWith("e1");
  });

  it("does nothing for a pointer that only passes over the row", () => {
    const onIntent = vi.fn();
    const { result } = renderHook(() => useHoverIntent(onIntent));

    act(() => result.current.start("e1"));
    act(() => vi.advanceTimersByTime(HOVER_INTENT_MS / 2));
    act(() => result.current.cancel());
    act(() => vi.advanceTimersByTime(HOVER_INTENT_MS));
    expect(onIntent).not.toHaveBeenCalled();
  });

  it("only fires for the last row the pointer rests on", () => {
    const onIntent = vi.fn();
    const { result } = renderHook(() => useHoverIntent(onIntent));

    act(() => result.current.start("e1"));
    act(() => vi.advanceTimersByTime(HOVER_INTENT_MS / 2));
    act(() => result.current.start("e2"));
    act(() => vi.advanceTimersByTime(HOVER_INTENT_MS));
    expect(onIntent).toHaveBeenCalledTimes(1);
    expect(onIntent).toHaveBeenCalledWith("e2");
  });

  it("stops waiting when the list goes away", () => {
    const onIntent = vi.fn();
    const { result, unmount } = renderHook(() => useHoverIntent(onIntent));

    act(() => result.current.start("e1"));
    unmount();
    act(() => vi.advanceTimersByTime(HOVER_INTENT_MS));
    expect(onIntent).not.toHaveBeenCalled();
  });
});
