import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { estimatedProgress, TYPICAL_GENERATION_MS } from "@/lib/image-generation/progress";

import { useEstimatedProgress } from "./use-estimated-progress";

describe("useEstimatedProgress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("advances with the time since it mounted", () => {
    const { result, unmount } = renderHook(() => useEstimatedProgress());
    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(TYPICAL_GENERATION_MS);
    });
    expect(result.current).toBe(estimatedProgress(TYPICAL_GENERATION_MS));

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
