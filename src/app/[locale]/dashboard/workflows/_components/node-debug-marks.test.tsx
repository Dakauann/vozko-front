import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { NODE_BREAKPOINT, NODE_PAUSED, type NodeDebugMarks } from "@/lib/workflows/debug-marks";

import { createNodeDebugStore, NodeDebugContext, useNodeDebugFlags } from "./node-debug-marks";

function marks(overrides: Partial<NodeDebugMarks> = {}): NodeDebugMarks {
  return { breakpoints: new Set(), realCalls: new Set(), pausedNodeId: null, activeNodeId: null, ...overrides };
}

describe("useNodeDebugFlags", () => {
  it("reads nothing outside the editor, so the CRM drawer keeps its look", () => {
    const { result } = renderHook(() => useNodeDebugFlags("a"));
    expect(result.current).toBe(0);
  });

  it("re-renders a node only when its own marks change, so a test step does not repaint the graph", () => {
    const store = createNodeDebugStore();
    const wrapper = ({ children }: { children: ReactNode }) => <NodeDebugContext.Provider value={store}>{children}</NodeDebugContext.Provider>;
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders += 1;
        return useNodeDebugFlags("x");
      },
      { wrapper },
    );

    act(() => store.set(marks({ breakpoints: new Set(["x"]) })));
    expect(result.current).toBe(NODE_BREAKPOINT);
    const afterBreakpoint = renders;

    act(() => store.set(marks({ breakpoints: new Set(["x"]), pausedNodeId: "other" })));
    expect(renders).toBe(afterBreakpoint);

    act(() => store.set(marks({ breakpoints: new Set(["x"]), pausedNodeId: "x" })));
    expect(result.current).toBe(NODE_BREAKPOINT | NODE_PAUSED);
  });
});
