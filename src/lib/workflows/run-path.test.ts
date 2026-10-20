import { describe, expect, it } from "vitest";

import { deriveRunOverlay, runNodeMark, type RunPathEdge, type RunPathStep } from "./run-path";

const edges: RunPathEdge[] = [
  { id: "e-t-a", source: "t", target: "a" },
  { id: "e-a-b", source: "a", target: "b", label: "default" },
  { id: "e-a-c", source: "a", target: "c", label: "erro" },
  { id: "e-b-c", source: "b", target: "c" },
  { id: "e-c-b", source: "c", target: "b", label: "retry" },
  { id: "e-c-d", source: "c", target: "d", label: "done" },
  { id: "e-x-y", source: "x", target: "y" },
];

function step(nodeId: string, status = "executed", branch?: string): RunPathStep {
  return { nodeId, status, branch };
}

describe("deriveRunOverlay", () => {
  it("highlights the edges between consecutive steps so the executed path reads left to right", () => {
    const overlay = deriveRunOverlay({ steps: [step("a", "executed", "default"), step("b"), step("c", "executed", "done"), step("d")], edges });

    expect([...overlay.traversedEdgeIds].sort()).toEqual(["e-a-b", "e-b-c", "e-c-d"]);
    expect([...overlay.executedNodeIds].sort()).toEqual(["a", "b", "c", "d"]);
    expect(overlay.failedNodeIds.size).toBe(0);
  });

  it("follows the recorded branch when two edges join the same pair of nodes", () => {
    const parallel: RunPathEdge[] = [
      { id: "ok", source: "a", target: "b", label: "default" },
      { id: "fail", source: "a", target: "b", label: "erro" },
    ];

    const overlay = deriveRunOverlay({ steps: [step("a", "executed", "erro"), step("b")], edges: parallel });

    expect([...overlay.traversedEdgeIds]).toEqual(["fail"]);
  });

  it("reads the branch from the edge source handle when the edge has no label", () => {
    const handles: RunPathEdge[] = [
      { id: "yes", source: "a", target: "b", sourceHandle: "sim" },
      { id: "no", source: "a", target: "b", sourceHandle: "nao" },
    ];

    const overlay = deriveRunOverlay({ steps: [step("a", "executed", "nao"), step("b")], edges: handles });

    expect([...overlay.traversedEdgeIds]).toEqual(["no"]);
  });

  it("reads the branch as the saved graph does: the source handle wins over a display label", () => {
    const labelled: RunPathEdge[] = [
      { id: "shown-error", source: "a", target: "b", sourceHandle: "success", label: "error" },
      { id: "real-error", source: "a", target: "b", sourceHandle: "error", label: "Falha" },
    ];

    const overlay = deriveRunOverlay({ steps: [step("a", "executed", "error"), step("b")], edges: labelled });

    expect([...overlay.traversedEdgeIds]).toEqual(["real-error"]);
  });

  it("keeps every lap of a loop, including the backward edge", () => {
    const overlay = deriveRunOverlay({
      steps: [step("a", "executed", "default"), step("b"), step("c", "executed", "retry"), step("b"), step("c", "executed", "done"), step("d")],
      edges,
    });

    expect([...overlay.traversedEdgeIds].sort()).toEqual(["e-a-b", "e-b-c", "e-c-b", "e-c-d"]);
  });

  it("draws no self edge for retries and clears the failure once a later attempt succeeds", () => {
    const overlay = deriveRunOverlay({ steps: [step("a", "executed", "default"), step("b", "failed"), step("b", "failed"), step("b"), step("c")], edges });

    expect([...overlay.traversedEdgeIds].sort()).toEqual(["e-a-b", "e-b-c"]);
    expect(overlay.failedNodeIds.size).toBe(0);
  });

  it("marks the node whose last attempt failed", () => {
    const overlay = deriveRunOverlay({ steps: [step("a", "executed", "default"), step("b"), step("c", "failed")], edges });

    expect([...overlay.failedNodeIds]).toEqual(["c"]);
  });

  it("marks a node that failed on a later lap even if it succeeded before", () => {
    const overlay = deriveRunOverlay({ steps: [step("b"), step("c", "executed", "retry"), step("b"), step("c", "failed")], edges });

    expect([...overlay.failedNodeIds]).toEqual(["c"]);
  });

  it("connects the trigger to the first step when the trigger wrote no step", () => {
    const overlay = deriveRunOverlay({ steps: [step("a", "executed", "default"), step("b")], edges, triggerNodeId: "t" });

    expect(overlay.executedNodeIds.has("t")).toBe(true);
    expect(overlay.traversedEdgeIds.has("e-t-a")).toBe(true);
  });

  it("does not repeat the trigger when it already wrote the first step", () => {
    const overlay = deriveRunOverlay({ steps: [step("t"), step("a")], edges, triggerNodeId: "t" });

    expect([...overlay.traversedEdgeIds]).toEqual(["e-t-a"]);
  });

  it("skips jumps between nodes that no edge connects instead of guessing a route", () => {
    const overlay = deriveRunOverlay({ steps: [step("a"), step("d")], edges });

    expect(overlay.traversedEdgeIds.size).toBe(0);
    expect([...overlay.executedNodeIds].sort()).toEqual(["a", "d"]);
  });

  it("stays empty for a run with no steps, even with a trigger", () => {
    const overlay = deriveRunOverlay({ steps: [], edges, triggerNodeId: "t" });

    expect(overlay.executedNodeIds.size).toBe(0);
    expect(overlay.traversedEdgeIds.size).toBe(0);
  });
});

describe("runNodeMark", () => {
  const overlay = deriveRunOverlay({ steps: [step("a", "executed", "default"), step("b", "failed")], edges });

  it("tells the canvas how to draw each node while a run is selected", () => {
    expect(runNodeMark(overlay, "a")).toBe("executed");
    expect(runNodeMark(overlay, "b")).toBe("failed");
    expect(runNodeMark(overlay, "x")).toBe("untouched");
  });

  it("returns no mark without a selected run so the canvas looks exactly as before", () => {
    expect(runNodeMark(null, "a")).toBeNull();
  });
});
