import type { ReactFlowState } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { hasSelectedEdge, selectedNodeCount } from "./canvas-selection";

function state(nodes: boolean[], edges: boolean[]): ReactFlowState {
  return {
    nodes: nodes.map((selected, index) => ({ id: `n${index}`, position: { x: 0, y: 0 }, data: {}, selected })),
    edges: edges.map((selected, index) => ({ id: `e${index}`, source: "a", target: "b", selected })),
  } as unknown as ReactFlowState;
}

describe("canvas selection", () => {
  it("counts selected nodes up to two, enough to tell none, one and several apart", () => {
    expect(selectedNodeCount(state([false, false], []))).toBe(0);
    expect(selectedNodeCount(state([true, false], []))).toBe(1);
    expect(selectedNodeCount(state([true, true, true], []))).toBe(2);
  });

  it("tells when an edge is selected, so the delete button shows for an edge alone", () => {
    expect(hasSelectedEdge(state([], [false, true]))).toBe(true);
    expect(hasSelectedEdge(state([true], [false]))).toBe(false);
  });
});
