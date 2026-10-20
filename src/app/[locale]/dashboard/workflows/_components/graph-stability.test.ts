import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";

import {
  graphBounds,
  holdDuringGesture,
  sameNodeGeometry,
  sameNodeLayout,
  sameEdgeStructure,
  sameNodeStructure,
} from "./graph-stability";
import { createWorkflowSnapshot, flowToDomain } from "./workflow-graph";

function node(id: string, x: number, data: Record<string, unknown> = { nodeType: "action_code", config: {} }): Node {
  return { id, type: "workflowNode", position: { x, y: 0 }, measured: { width: 200, height: 80 }, data };
}

function group(id: string, width: number): Node {
  return { id, type: "groupNode", position: { x: 0, y: 0 }, width, height: 200, data: { nodeType: "group", config: {} } };
}

function moved(nodes: Node[], id: string, x: number, dragging?: boolean): Node[] {
  return nodes.map((n) => (n.id === id ? { ...n, position: { x, y: n.position.y }, dragging } : n));
}

describe("sameNodeStructure", () => {
  const base = [node("a", 0), node("b", 300)];

  it("ignores moves, selection and measurement so drag frames reuse every structure-derived value", () => {
    const next = moved(base, "a", 40, true).map((n) => ({ ...n, selected: true, measured: { width: 210, height: 90 } }));
    expect(sameNodeStructure(base, next)).toBe(true);
  });

  it("changes when a node's data is replaced, as a config edit does", () => {
    const next = base.map((n) => (n.id === "b" ? { ...n, data: { ...n.data } } : n));
    expect(sameNodeStructure(base, next)).toBe(false);
  });

  it("changes when nodes are added, removed or renamed", () => {
    expect(sameNodeStructure(base, [...base, node("c", 600)])).toBe(false);
    expect(sameNodeStructure(base, base.slice(1))).toBe(false);
    expect(sameNodeStructure(base, [{ ...base[0], id: "z" }, base[1]])).toBe(false);
  });

  it("changes when a background group is resized, since its size is saved in its config", () => {
    expect(sameNodeStructure([group("g", 400)], [group("g", 420)])).toBe(false);
  });
});

describe("sameNodeLayout", () => {
  const base = [node("a", 0), node("b", 300)];

  it("changes when a node moves", () => {
    expect(sameNodeLayout(base, moved(base, "a", 10))).toBe(false);
  });

  it("ignores selection", () => {
    expect(sameNodeLayout(base, base.map((n) => ({ ...n, selected: true })))).toBe(true);
  });
});

describe("sameNodeGeometry", () => {
  const base = [node("a", 0)];

  it("changes when a node is measured at a new size, which re-routes edges", () => {
    expect(sameNodeGeometry(base, [{ ...base[0], measured: { width: 200, height: 120 } }])).toBe(false);
  });

  it("ignores config edits that keep the size", () => {
    expect(sameNodeGeometry(base, [{ ...base[0], data: { nodeType: "action_code", config: { code: "x" } } }])).toBe(true);
  });
});

describe("holdDuringGesture", () => {
  const settledLayout = holdDuringGesture(sameNodeLayout);
  const base = [node("a", 0), node("b", 300)];

  it("keeps the previous layout while a node is being dragged", () => {
    expect(settledLayout(base, moved(base, "a", 80, true))).toBe(true);
  });

  it("takes the new layout once the drag ends", () => {
    expect(settledLayout(base, moved(base, "a", 80, false))).toBe(false);
  });

  it("marks the workflow dirty after the drop and not during the drag", () => {
    const edges: Edge[] = [{ id: "e", source: "a", target: "b" }];
    const meta = { name: "Fluxo", description: "", workflowType: "messages" as const };
    const saved = createWorkflowSnapshot({ ...meta, graph: flowToDomain(base, edges) });
    let layout = base;
    const frames = [moved(base, "a", 20, true), moved(base, "a", 60, true), moved(base, "a", 60, false)];
    const dirtyPerFrame = frames.map((frame) => {
      if (!settledLayout(layout, frame)) layout = frame;
      return createWorkflowSnapshot({ ...meta, graph: flowToDomain(layout, edges) }) !== saved;
    });
    expect(dirtyPerFrame).toEqual([false, false, true]);
  });
});

describe("graphBounds", () => {
  it("pads the measured extent of every node", () => {
    expect(graphBounds([node("a", 0), node("b", 300)], 20)).toEqual({ x: -20, y: -20, width: 540, height: 120 });
  });

  it("falls back to a default canvas when the graph is empty", () => {
    expect(graphBounds([], 20)).toEqual({ x: -900, y: -650, width: 1800, height: 1300 });
  });
});

describe("sameEdgeStructure", () => {
  const base: Edge[] = [{ id: "e1", source: "a", target: "b", sourceHandle: "default", label: "default" }];

  it("ignores selection so picking an edge does not rebuild the run path", () => {
    expect(sameEdgeStructure(base, [{ ...base[0], selected: true }])).toBe(true);
  });

  it("notices a rewired, relabelled, added or removed edge", () => {
    expect(sameEdgeStructure(base, [{ ...base[0], target: "c" }])).toBe(false);
    expect(sameEdgeStructure(base, [{ ...base[0], label: "erro", sourceHandle: "erro" }])).toBe(false);
    expect(sameEdgeStructure(base, [...base, { id: "e2", source: "b", target: "c" }])).toBe(false);
    expect(sameEdgeStructure(base, [])).toBe(false);
  });
});
