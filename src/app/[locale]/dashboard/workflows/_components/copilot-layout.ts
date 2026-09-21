import type { Edge, Node } from "@xyflow/react";
import type { ELK, ElkNode } from "elkjs/lib/elk-api";


const NODE_W = 260;
const NODE_H = 120;

const COL_GAP = 140;
const ROW_GAP = 64;
const ANCHOR_GAP = 120;
const ORIGIN = 80;

let elkPromise: Promise<ELK> | null = null;
async function getElk(): Promise<ELK> {
  if (!elkPromise) {
    elkPromise = import("elkjs/lib/elk.bundled.js").then((m) => new m.default());
  }
  return elkPromise;
}

function sizeOf(n: Node): { w: number; h: number } {
  const w =
    n.measured?.width ?? (typeof n.width === "number" ? n.width : undefined) ?? NODE_W;
  const h =
    n.measured?.height ??
    (typeof n.height === "number" ? n.height : undefined) ??
    estimateHeight(n);
  return { w, h };
}

function estimateHeight(n: Node): number {
  const outputs = (n.data as { outputs?: unknown[] } | undefined)?.outputs;
  const rows = Array.isArray(outputs) ? outputs.filter(Boolean).length : 0;
  return Math.max(96, 64 + rows * 22);
}

function isFlowNode(n: Node): boolean {
  return n.type !== "groupNode";
}

function outputIndex(node: Node | undefined, handle: string | null | undefined): number {
  const outputs = (node?.data as { outputs?: { id: string }[] } | undefined)?.outputs;
  if (!outputs || !handle) return Number.MAX_SAFE_INTEGER;
  const i = outputs.findIndex((o) => o.id === handle);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}

function flowOrderIndex(
  flowNodes: Node[],
  edges: Edge[],
  byId: Map<string, Node>,
): Map<string, number> {
  const flowIds = new Set(flowNodes.map((n) => n.id));

  const outgoing = new Map<string, Edge[]>();
  const hasIncoming = new Set<string>();
  for (const e of edges) {
    if (!flowIds.has(e.source) || !flowIds.has(e.target)) continue;
    const list = outgoing.get(e.source);
    if (list) list.push(e);
    else outgoing.set(e.source, [e]);
    hasIncoming.add(e.target);
  }
  for (const list of outgoing.values()) {
    list.sort(
      (a, b) =>
        outputIndex(byId.get(a.source), a.sourceHandle) -
          outputIndex(byId.get(b.source), b.sourceHandle) ||
        (byId.get(a.target)?.position.y ?? 0) -
          (byId.get(b.target)?.position.y ?? 0),
    );
  }

  const byY = (a: Node, b: Node) =>
    a.position.y - b.position.y || a.position.x - b.position.x;
  const roots = flowNodes.filter((n) => !hasIncoming.has(n.id)).sort(byY);

  const order = new Map<string, number>();
  let counter = 0;
  const visit = (id: string) => {
    if (order.has(id)) return;
    order.set(id, counter++);
    for (const e of outgoing.get(id) ?? []) visit(e.target);
  };
  for (const r of roots) visit(r.id);
  for (const n of [...flowNodes].sort(byY)) visit(n.id);
  return order;
}

function orderForElk(
  flowNodes: Node[],
  edges: Edge[],
  byId: Map<string, Node>,
): { ordered: Node[]; orderedEdges: Edge[] } {
  const flowIndex = flowOrderIndex(flowNodes, edges, byId);
  const ordered = [...flowNodes].sort(
    (a, b) => (flowIndex.get(a.id) ?? 0) - (flowIndex.get(b.id) ?? 0),
  );
  const rank = new Map(ordered.map((n, i) => [n.id, i]));
  const orderedEdges = [...edges].sort((a, b) => {
    const ra = rank.get(a.source) ?? 0;
    const rb = rank.get(b.source) ?? 0;
    if (ra !== rb) return ra - rb;
    return (
      outputIndex(byId.get(a.source), a.sourceHandle) -
      outputIndex(byId.get(b.source), b.sourceHandle)
    );
  });
  return { ordered, orderedEdges };
}

async function runElkLayered(
  items: { id: string; w: number; h: number }[],
  edges: { source: string; target: string }[],
): Promise<Map<string, { x: number; y: number }>> {
  const rel = new Map<string, { x: number; y: number }>();
  if (items.length === 0) return rel;
  let laid: ElkNode;
  try {
    const elk = await getElk();
    laid = await elk.layout({
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.layered.spacing.nodeNodeBetweenLayers": String(COL_GAP),
        "elk.spacing.nodeNode": String(ROW_GAP),
        "elk.layered.spacing.edgeNodeBetweenLayers": "36",
        "elk.spacing.edgeNode": "28",
        "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
        "elk.layered.cycleBreaking.strategy": "DEPTH_FIRST",
        "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        "elk.separateConnectedComponents": "true",
        "elk.spacing.componentComponent": "80",
      },
      children: items.map((it) => ({ id: it.id, width: it.w, height: it.h })),
      edges: edges.map((e, i) => ({
        id: `e${i}`,
        sources: [e.source],
        targets: [e.target],
      })),
    });
  } catch {
    return rel;
  }
  for (const c of laid.children ?? []) {
    rel.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 });
  }
  return rel;
}

export interface CopilotLayoutInput {
  nodes: Node[];
  edges: Edge[];
  touchedIds: Set<string>;
}

export async function layoutCopilotSubgraph({
  nodes,
  edges,
  touchedIds,
}: CopilotLayoutInput): Promise<Map<string, { x: number; y: number }>> {
  const result = new Map<string, { x: number; y: number }>();
  const touched = nodes.filter((n) => touchedIds.has(n.id));
  if (touched.length === 0) return result;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sizes = new Map(nodes.map((n) => [n.id, sizeOf(n)]));

  const internalEdges = edges.filter(
    (e) => touchedIds.has(e.source) && touchedIds.has(e.target),
  );
  const { ordered, orderedEdges } = orderForElk(touched, internalEdges, byId);
  const rel = await runElkLayered(
    ordered.map((n) => ({ id: n.id, ...sizes.get(n.id)! })),
    orderedEdges,
  );
  if (rel.size === 0) return result;

  const relMinX = Math.min(...[...rel.values()].map((p) => p.x));
  const relMinY = Math.min(...[...rel.values()].map((p) => p.y));

  let dx: number;
  let dy: number;

  const inEdge = edges.find(
    (e) =>
      !touchedIds.has(e.source) && touchedIds.has(e.target) && byId.has(e.source),
  );
  const outEdge = edges.find(
    (e) =>
      touchedIds.has(e.source) && !touchedIds.has(e.target) && byId.has(e.target),
  );

  if (inEdge) {
    const anchor = byId.get(inEdge.source)!;
    const aSize = sizes.get(anchor.id)!;
    const t = rel.get(inEdge.target)!;
    dx = anchor.position.x + aSize.w + ANCHOR_GAP - t.x;
    dy = anchor.position.y - t.y;
  } else if (outEdge) {
    const anchor = byId.get(outEdge.target)!;
    const t = rel.get(outEdge.source)!;
    const tSize = sizes.get(outEdge.source)!;
    dx = anchor.position.x - ANCHOR_GAP - tSize.w - t.x;
    dy = anchor.position.y - t.y;
  } else {
    const untouched = nodes.filter((n) => !touchedIds.has(n.id));
    if (untouched.length > 0) {
      let maxX = -Infinity;
      let minY = Infinity;
      for (const n of untouched) {
        const s = sizes.get(n.id)!;
        maxX = Math.max(maxX, n.position.x + s.w);
        minY = Math.min(minY, n.position.y);
      }
      dx = maxX + ANCHOR_GAP - relMinX;
      dy = minY - relMinY;
    } else {
      dx = ORIGIN - relMinX;
      dy = ORIGIN - relMinY;
    }
  }

  for (const [id, p] of rel) {
    result.set(id, { x: Math.round(p.x + dx), y: Math.round(p.y + dy) });
  }
  return result;
}

export async function layoutWholeFlow({
  nodes,
  edges,
}: {
  nodes: Node[];
  edges: Edge[];
}): Promise<Map<string, { x: number; y: number }>> {
  const result = new Map<string, { x: number; y: number }>();
  const flowNodes = nodes.filter(isFlowNode);
  if (flowNodes.length === 0) return result;

  const flowIds = new Set(flowNodes.map((n) => n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sizes = new Map(flowNodes.map((n) => [n.id, sizeOf(n)]));
  const internalEdges = edges.filter(
    (e) => flowIds.has(e.source) && flowIds.has(e.target),
  );
  const { ordered, orderedEdges } = orderForElk(flowNodes, internalEdges, byId);
  const rel = await runElkLayered(
    ordered.map((n) => ({ id: n.id, ...sizes.get(n.id)! })),
    orderedEdges,
  );
  if (rel.size === 0) return result;

  const curMinX = Math.min(...flowNodes.map((n) => n.position.x));
  const curMinY = Math.min(...flowNodes.map((n) => n.position.y));
  const relMinX = Math.min(...[...rel.values()].map((p) => p.x));
  const relMinY = Math.min(...[...rel.values()].map((p) => p.y));
  const dx = curMinX - relMinX;
  const dy = curMinY - relMinY;

  for (const [id, p] of rel) {
    result.set(id, { x: Math.round(p.x + dx), y: Math.round(p.y + dy) });
  }
  return result;
}
