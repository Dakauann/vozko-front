/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";

import { layoutCopilotSubgraph, layoutWholeFlow } from "./copilot-layout";

function node(id: string, x = 0, y = 0, w = 200, h = 100): Node {
  return {
    id,
    position: { x, y },
    data: {},
    measured: { width: w, height: h },
  } as Node;
}

function groupNode(id: string, x = 0, y = 0): Node {
  return { id, type: "groupNode", position: { x, y }, data: {} } as Node;
}

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target } as Edge;
}

describe("layoutCopilotSubgraph", () => {
  it("returns nothing when there are no touched nodes", async () => {
    const pos = await layoutCopilotSubgraph({
      nodes: [node("a")],
      edges: [],
      touchedIds: new Set(),
    });
    expect(pos.size).toBe(0);
  });

  it("lays out a touched chain left-to-right (x increases along the flow)", async () => {
    const nodes = [node("n1"), node("n2"), node("n3")];
    const edges = [edge("n1", "n2"), edge("n2", "n3")];
    const pos = await layoutCopilotSubgraph({
      nodes,
      edges,
      touchedIds: new Set(["n1", "n2", "n3"]),
    });
    expect(pos.size).toBe(3);
    const x1 = pos.get("n1")!.x;
    const x2 = pos.get("n2")!.x;
    const x3 = pos.get("n3")!.x;
    expect(x2).toBeGreaterThan(x1);
    expect(x3).toBeGreaterThan(x2);
  });

  it("only repositions touched nodes; never returns untouched ones", async () => {
    const nodes = [node("base", 0, 0), node("t1"), node("t2")];
    const edges = [edge("t1", "t2")];
    const pos = await layoutCopilotSubgraph({
      nodes,
      edges,
      touchedIds: new Set(["t1", "t2"]),
    });
    expect(pos.has("base")).toBe(false);
    expect(pos.has("t1")).toBe(true);
    expect(pos.has("t2")).toBe(true);
  });

  it("anchors a new cluster to the RIGHT of an existing node it flows from", async () => {
    const base = node("base", 500, 300, 200, 100);
    const nodes = [base, node("t1"), node("t2")];
    // base (untouched) → t1 → t2 (both touched)
    const edges = [edge("base", "t1"), edge("t1", "t2")];
    const pos = await layoutCopilotSubgraph({
      nodes,
      edges,
      touchedIds: new Set(["t1", "t2"]),
    });
    // t1 lands one column to the right of base, on the same row.
    expect(pos.get("t1")).toEqual({ x: 500 + 200 + 120, y: 300 });
    expect(pos.get("t2")!.x).toBeGreaterThan(pos.get("t1")!.x);
  });

  it("drops an unconnected cluster to the right of the existing bounding box", async () => {
    const base = node("base", 0, 0, 200, 100);
    const nodes = [base, node("t1")];
    const pos = await layoutCopilotSubgraph({
      nodes,
      edges: [],
      touchedIds: new Set(["t1"]),
    });
    // base spans x:[0,200]; the new node starts a gap to its right.
    expect(pos.get("t1")!.x).toBeGreaterThanOrEqual(200 + 120);
  });
});

describe("layoutWholeFlow", () => {
  it("tidies the whole graph left-to-right, anchored at the current top-left", async () => {
    // Scrambled positions; the chain n1→n2→n3 should come back ordered by x.
    const nodes = [node("n1", 700, 40), node("n2", 120, 500), node("n3", 360, 90)];
    const edges = [edge("n1", "n2"), edge("n2", "n3")];
    const pos = await layoutWholeFlow({ nodes, edges });
    expect(pos.size).toBe(3);
    expect(pos.get("n2")!.x).toBeGreaterThan(pos.get("n1")!.x);
    expect(pos.get("n3")!.x).toBeGreaterThan(pos.get("n2")!.x);
    // Anchored in place: the tidied flow keeps its current top-left corner.
    const minX = Math.min(...[...pos.values()].map((p) => p.x));
    const minY = Math.min(...[...pos.values()].map((p) => p.y));
    expect(minX).toBe(120); // smallest current x among the nodes
    expect(minY).toBe(40); // smallest current y among the nodes
  });

  it("orders a branch's targets by output-handle sequence (top output → above)", async () => {
    // A source with two outputs; its top handle's target must end up ABOVE the
    // bottom handle's target, regardless of the targets' current Y.
    const src = {
      id: "src",
      position: { x: 0, y: 0 },
      data: { outputs: [{ id: "top" }, { id: "bottom" }] },
      measured: { width: 200, height: 100 },
    } as Node;
    // Give the targets a misleading current Y (top lower than bottom) to prove the
    // layout follows the edge order, not the existing positions.
    const nodes = [src, node("t_top", 0, 900), node("t_bottom", 0, 10)];
    const edges = [
      { id: "e1", source: "src", target: "t_top", sourceHandle: "top" } as Edge,
      { id: "e2", source: "src", target: "t_bottom", sourceHandle: "bottom" } as Edge,
    ];
    const pos = await layoutWholeFlow({ nodes, edges });
    expect(pos.get("t_top")!.y).toBeLessThan(pos.get("t_bottom")!.y);
  });

  it("never moves or returns group/decoration nodes", async () => {
    const nodes = [groupNode("g1", 0, 0), node("n1", 50, 50), node("n2", 90, 90)];
    const edges = [edge("n1", "n2")];
    const pos = await layoutWholeFlow({ nodes, edges });
    expect(pos.has("g1")).toBe(false);
    expect(pos.has("n1")).toBe(true);
    expect(pos.has("n2")).toBe(true);
  });
});
