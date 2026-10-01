import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "./use-debounced-value";

describe("useDebouncedValue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("settles on the last value once typing pauses", () => {
    const hook = renderHook(({ value }) => useDebouncedValue(value, 300), { initialProps: { value: "8" } });
    hook.rerender({ value: "84" });
    hook.rerender({ value: "849" });
    act(() => vi.advanceTimersByTime(299));
    expect(hook.result.current).toBe("8");
    act(() => vi.advanceTimersByTime(1));
    expect(hook.result.current).toBe("849");
  });
});
