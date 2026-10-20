import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useStableCallback } from "./use-stable-callback";

describe("useStableCallback", () => {
  it("keeps one identity across renders, so memoised children do not re-render", () => {
    const { result, rerender } = renderHook(({ value }) => useStableCallback(() => value), { initialProps: { value: 1 } });
    const first = result.current;
    rerender({ value: 2 });
    expect(result.current).toBe(first);
  });

  it("always calls the latest function with the latest render's values", () => {
    const seen = vi.fn();
    const { result, rerender } = renderHook(({ value }) => useStableCallback((extra: string) => seen(value, extra)), {
      initialProps: { value: "a" },
    });
    rerender({ value: "b" });
    result.current("x");
    expect(seen).toHaveBeenCalledWith("b", "x");
  });
});
