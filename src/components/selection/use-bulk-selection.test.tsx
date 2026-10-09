import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useBulkSelection } from "./use-bulk-selection";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("useBulkSelection", () => {
  it("keeps picks while the scope stays and drops them when it changes", () => {
    const { result, rerender } = renderHook(({ scope }) => useBulkSelection(scope), { initialProps: { scope: "a" } });
    act(() => result.current.setPicked(new Set(["l-1", "l-2"])));
    rerender({ scope: "a" });
    expect(result.current.size).toBe(2);
    rerender({ scope: "b" });
    expect(result.current.size).toBe(0);
    expect(result.current.mode).toBeNull();
  });

  it("widens with the counted total and marks the selection as counting meanwhile", async () => {
    const { result } = renderHook(() => useBulkSelection("a"));
    const count = deferred<{ matched: number; fingerprint: string } | null>();
    act(() => result.current.setPicked(new Set(["l-1"])));
    let widening!: Promise<unknown>;
    act(() => {
      widening = result.current.widen("all_matching", () => count.promise);
    });
    expect(result.current.counting).toBe("all_matching");
    await act(async () => {
      count.resolve({ matched: 352, fingerprint: "fp-1" });
      await widening;
    });
    expect(result.current.counting).toBeNull();
    expect(result.current.wide).toEqual({ mode: "all_matching", scope: "a", matched: 352, fingerprint: "fp-1" });
    expect(result.current.size).toBe(352);
  });

  it("ignores a count that answers after the scope changed", async () => {
    const { result, rerender } = renderHook(({ scope }) => useBulkSelection(scope), { initialProps: { scope: "a" } });
    const count = deferred<{ matched: number } | null>();
    let widening!: Promise<unknown>;
    act(() => {
      widening = result.current.widen("all_matching", () => count.promise);
    });
    rerender({ scope: "b" });
    await act(async () => {
      count.resolve({ matched: 352 });
      await widening;
    });
    expect(result.current.wide).toBeNull();
    expect(result.current.scope).toBe("b");
  });

  it("keeps the picks when the count fails", async () => {
    const { result } = renderHook(() => useBulkSelection("a"));
    act(() => result.current.setPicked(new Set(["l-1"])));
    await act(async () => {
      await result.current.widen("all_matching", async () => null);
    });
    expect(result.current.counting).toBeNull();
    expect(result.current.mode).toBe("ids");
  });

  it("selects a known total without counting again", () => {
    const { result } = renderHook(() => useBulkSelection("a"));
    act(() => result.current.select({ mode: "first_n", matched: 1204, limit: 500 }));
    expect(result.current.size).toBe(500);
    expect(result.current.mode).toBe("first_n");
    act(() => result.current.clear());
    expect(result.current.size).toBe(0);
  });
});
