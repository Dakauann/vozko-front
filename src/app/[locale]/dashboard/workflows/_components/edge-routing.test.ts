import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";

import { fixtureWorkflow } from "../../../../../../scripts/workflows-perf/fixture";

import {
  buildObstacleIndex,
  computePath,
  flatObstacleIndex,
  nodeBounds,
  plainPath,
} from "./edge-routing";

const GROUP_TYPES = new Set(["group", "decoration_background"]);

function fixtureNodes(): Node[] {
  return fixtureWorkflow().graph.nodes.map((node, i) => {
    const isGroup = GROUP_TYPES.has(node.type);
    const width = isGroup ? Number(node.config._width) : i % 3 === 0 ? 232 : 200;
    const height = isGroup ? Number(node.config._height) : 58 + ((i * 37) % 97) + 0.5;
    return { id: node.id, type: isGroup ? "groupNode" : "workflowNode", position: node.position, measured: { width, height }, data: {} };
  });
}

function endpoints(nodes: Node[], source: string, target: string) {
  const from = nodeBounds(nodes.find((n) => n.id === source)!);
  const to = nodeBounds(nodes.find((n) => n.id === target)!);
  return { sx: from.r + 5, sy: from.cy, tx: to.x - 5, ty: to.cy };
}

describe("computePath with the shared obstacle index", () => {
  const nodes = fixtureNodes();
  const grid = buildObstacleIndex(nodes);
  const flat = flatObstacleIndex(nodes);

  it("routes every edge of the large fixture exactly as a scan over all nodes does", () => {
    const { edges } = fixtureWorkflow().graph;
    let backward = 0;
    for (const edge of edges) {
      const { sx, sy, tx, ty } = endpoints(nodes, edge.source, edge.target);
      if (tx - sx < 50) backward += 1;
      expect(computePath(sx, sy, tx, ty, grid, edge.source, edge.target)).toEqual(
        computePath(sx, sy, tx, ty, flat, edge.source, edge.target),
      );
    }
    expect(backward).toBeGreaterThan(30);
  });

  it("stays identical for endpoints dropped anywhere on the canvas, as while drawing a new connection", () => {
    const ids = nodes.filter((n) => n.type !== "groupNode").map((n) => n.id);
    for (let i = 0; i < 400; i++) {
      const source = ids[(i * 7) % ids.length];
      const sx = ((i * 131) % 4400) - 200;
      const sy = ((i * 89) % 2300) - 100;
      const tx = ((i * 197) % 4400) - 200;
      const ty = ((i * 53) % 2300) - 100;
      expect(computePath(sx, sy, tx, ty, grid, source, "__drag_target__")).toEqual(
        computePath(sx, sy, tx, ty, flat, source, "__drag_target__"),
      );
    }
  });
});

describe("plainPath", () => {
  it("is what a forward edge draws when nothing sits in its corridor", () => {
    const index = buildObstacleIndex([]);
    expect(computePath(0, 0, 400, 120, index, "a", "b")).toEqual(plainPath(0, 0, 400, 120));
  });

  it("differs from the routed path once a node blocks the corridor, so drop must re-route", () => {
    const blocker: Node = { id: "c", type: "workflowNode", position: { x: 150, y: 20 }, measured: { width: 100, height: 60 }, data: {} };
    const index = buildObstacleIndex([blocker]);
    expect(computePath(0, 50, 400, 60, index, "a", "b")).not.toEqual(plainPath(0, 50, 400, 60));
  });
});

describe("buildObstacleIndex", () => {
  it("never treats background groups as obstacles", () => {
    const group: Node = { id: "g", type: "groupNode", position: { x: 100, y: -200 }, measured: { width: 300, height: 600 }, data: {} };
    const index = buildObstacleIndex([group]);
    expect(computePath(0, 0, 500, 0, index, "a", "b")).toEqual(plainPath(0, 0, 500, 0));
    expect(index.bounds("g")).toEqual(nodeBounds(group));
  });
});
