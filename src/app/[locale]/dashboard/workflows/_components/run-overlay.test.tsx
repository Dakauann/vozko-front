import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { deriveRunOverlay } from "@/lib/workflows/run-path";

import { createRunOverlayStore, RunOverlayContext, useRunNodeMark } from "./run-overlay";

const overlay = deriveRunOverlay({
  steps: [
    { nodeId: "a", status: "executed" },
    { nodeId: "b", status: "failed" },
  ],
  edges: [{ id: "e", source: "a", target: "b" }],
});

describe("useRunNodeMark", () => {
  it("reads nothing outside the editor, so the CRM drawer keeps its look", () => {
    const { result } = renderHook(() => useRunNodeMark("a"));
    expect(result.current).toBeNull();
  });

  it("re-renders a node only when its own mark changes", () => {
    const store = createRunOverlayStore();
    const wrapper = ({ children }: { children: ReactNode }) => <RunOverlayContext.Provider value={store}>{children}</RunOverlayContext.Provider>;
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders += 1;
        return useRunNodeMark("x");
      },
      { wrapper },
    );
    expect(result.current).toBeNull();

    act(() => store.set(overlay));
    expect(result.current).toBe("untouched");
    const afterSelect = renders;

    act(() => store.set(deriveRunOverlay({ steps: [{ nodeId: "a", status: "executed" }], edges: [] })));
    expect(renders).toBe(afterSelect);

    act(() => store.set(null));
    expect(result.current).toBeNull();
  });

  it("marks the failing node", () => {
    const store = createRunOverlayStore();
    store.set(overlay);
    const wrapper = ({ children }: { children: ReactNode }) => <RunOverlayContext.Provider value={store}>{children}</RunOverlayContext.Provider>;
    const { result } = renderHook(() => [useRunNodeMark("a"), useRunNodeMark("b")], { wrapper });
    expect(result.current).toEqual(["executed", "failed"]);
  });
});
