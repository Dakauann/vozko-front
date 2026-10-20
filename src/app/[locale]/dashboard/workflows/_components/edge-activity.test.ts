import { describe, expect, it, vi } from "vitest";
import type { Edge } from "@xyflow/react";

import { createHoverStore, edgeTouches, isEdgeFlowing, withFlowingPath, withRunPath } from "./edge-activity";

describe("isEdgeFlowing", () => {
  const idle = { touchesHovered: false, endpointSelected: false, data: undefined };

  it("keeps an edge still when nothing around it is active", () => {
    expect(isEdgeFlowing(idle)).toBe(false);
  });

  it("animates the edges of the selected node", () => {
    expect(isEdgeFlowing({ ...idle, endpointSelected: true })).toBe(true);
  });

  it("animates the edges of the hovered node only", () => {
    expect(isEdgeFlowing({ ...idle, touchesHovered: edgeTouches("b", "a", "b") })).toBe(true);
    expect(isEdgeFlowing({ ...idle, touchesHovered: edgeTouches("c", "a", "b") })).toBe(false);
    expect(isEdgeFlowing({ ...idle, touchesHovered: edgeTouches(null, "a", "b") })).toBe(false);
  });

  it("animates an edge marked as part of an executed path", () => {
    expect(isEdgeFlowing({ ...idle, data: { flowing: true } })).toBe(true);
  });
});

describe("withFlowingPath", () => {
  it("marks only the given edges and keeps the others untouched", () => {
    const edges: Edge[] = [
      { id: "e1", source: "a", target: "b", data: { _appearSeq: 1 } },
      { id: "e2", source: "b", target: "c" },
    ];
    const marked = withFlowingPath(edges, new Set(["e1"]));
    expect(marked[0].data).toEqual({ _appearSeq: 1, flowing: true });
    expect(marked[1]).toBe(edges[1]);
  });
});

describe("withRunPath", () => {
  const edges: Edge[] = [
    { id: "e1", source: "a", target: "b", data: { _appearSeq: 1 } },
    { id: "e2", source: "b", target: "c" },
  ];

  it("flows the traversed edges and dims the rest while a run is selected", () => {
    const marked = withRunPath(edges, new Set(["e1"]));
    expect(marked[0].data).toEqual({ _appearSeq: 1, flowing: true });
    expect(marked[1].data).toEqual({ runDim: true });
  });

  it("never touches the edges it was given, so clearing the run restores them", () => {
    withRunPath(edges, new Set(["e1"]));
    expect(edges[0].data).toEqual({ _appearSeq: 1 });
    expect(edges[1].data).toBeUndefined();
  });

  it("hands back the same edge object while its mark stays, so a test step re-renders only the edges it changed", () => {
    const first = withRunPath(edges, new Set(["e1"]));
    const second = withRunPath(edges, new Set(["e1"]));
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
    const third = withRunPath(edges, new Set(["e1", "e2"]));
    expect(third[0]).toBe(first[0]);
    expect(third[1]).not.toBe(first[1]);
    expect(third[1].data).toEqual({ flowing: true });
  });
});

describe("createHoverStore", () => {
  it("notifies subscribers when the hovered node changes and stays quiet on repeats", () => {
    const store = createHoverStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set("a");
    store.set("a");
    store.set(null);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.get()).toBeNull();
    unsubscribe();
    store.set("b");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
