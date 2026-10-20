import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import { useStableValue } from "./use-stable-value";

const sameLength = (a: number[], b: number[]) => a.length === b.length;

describe("useStableValue", () => {
  it("keeps returning the first value while the comparison says nothing relevant changed", () => {
    const first = [1, 2];
    const { result, rerender } = renderHook(({ value }) => useStableValue(value, sameLength), { initialProps: { value: first } });
    rerender({ value: [3, 4] });
    expect(result.current).toBe(first);
  });

  it("switches to the new value as soon as it differs", () => {
    const { result, rerender } = renderHook(({ value }) => useStableValue(value, sameLength), { initialProps: { value: [1] } });
    const next = [1, 2];
    rerender({ value: next });
    expect(result.current).toBe(next);
    rerender({ value: [5, 6] });
    expect(result.current).toBe(next);
  });
});
