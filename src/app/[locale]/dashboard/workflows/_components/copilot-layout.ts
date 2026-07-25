import type { Edge, Node } from "@xyflow/react";
import type { ELK, ElkNode } from "elkjs/lib/elk-api";

// Layered LR (left-to-right) auto-layout, mirroring n8n's "Tidy Up" (Eclipse
// Layout Kernel, `layered`/Sugiyama algorithm). Two entry points:
//   • layoutCopilotSubgraph, repositions ONLY the copilot-touched nodes and
//     anchors them next to the user's existing nodes (used while the AI builds).
//   • layoutWholeFlow      , tidies the ENTIRE graph in place (the canvas
//     "Tidy up" button), the way n8n's canvas control works.

// Fallback dimensions for brand-new nodes the canvas hasn't measured yet.
// Cards are `min-w-[200px] min-h-[100px]`; real cards run a bit larger.
const NODE_W = 260;
const NODE_H = 120;

// Spacing, comparable to n8n / the React Flow ELK example, tuned for our cards.
const COL_GAP = 140; // between layers (columns), left→right
const ROW_GAP = 64; // between nodes within the same layer (vertical)
const ANCHOR_GAP = 120; // gap from an existing anchor node to the new cluster
const ORIGIN = 80; // where a brand-new, unanchored cluster starts

// elkjs ships a ~1.4MB GWT bundle; load it only when a layout actually runs.
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

// Height estimate for a node the canvas hasn't measured yet (a brand-new copilot
// node). A branching node is much taller than a plain one — one row per output —
// so estimating from the output count keeps tall nodes from being laid out as if
// short and overlapping their neighbours.
function estimateHeight(n: Node): number {
  const outputs = (n.data as { outputs?: unknown[] } | undefined)?.outputs;
  const rows = Array.isArray(outputs) ? outputs.filter(Boolean).length : 0;
  return Math.max(96, 64 + rows * 22);
}

// Group/decoration nodes are visual containers, not flow steps, the layered
// layout must ignore them (and never move them).
function isFlowNode(n: Node): boolean {
  return n.type !== "groupNode";
}

// outputIndex is the vertical rank of an edge's source handle (0 = top), read from
// the node's backend-resolved output handles. Edges with no/unknown handle sort
// last, so explicitly-handled branches keep priority.
function outputIndex(node: Node | undefined, handle: string | null | undefined): number {
  const outputs = (node?.data as { outputs?: { id: string }[] } | undefined)?.outputs;
  if (!outputs || !handle) return Number.MAX_SAFE_INTEGER;
  const i = outputs.findIndex((o) => o.id === handle);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}

// flowOrderIndex ranks nodes by the FLOW (edge) sequence: a depth-first walk from
// the roots (nodes with no incoming edge) that follows each node's output handles
// top-to-bottom. This is the fix for the "should be on top but ends up on the
// bottom" bug — feeding ELK the CURRENT Y order just preserved whatever mess the
// graph already had; feeding it the edge-order lets the drawn layout follow the
// handles (a node's top output → above its lower output).
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
  // Each node's outgoing edges are visited in output-handle order (top first),
  // ties broken by the target's current Y for stability.
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
    if (order.has(id)) return; // also breaks cycles (VoIP loops back to the agent)
    order.set(id, counter++);
    for (const e of outgoing.get(id) ?? []) visit(e.target);
  };
  for (const r of roots) visit(r.id);
  // Disconnected or purely-cyclic leftovers: append by current Y so they're stable.
  for (const n of [...flowNodes].sort(byY)) visit(n.id);
  return order;
}

// orderForElk returns nodes in flow order and edges grouped by source in that same
// order, then by source-handle order. ELK biases the layout to this input order
// via considerModelOrder.
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

/**
 * Run ELK's `layered` (left→right) algorithm over a set of sized nodes and the
 * edges among them. Returns RELATIVE positions (ELK's own origin); callers
 * translate as needed. Resolves to an empty map on any failure so the canvas is
 * never blocked.
 */
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
        // Follow the order we feed nodes/edges in (flow order): a source's outputs
        // stay top-to-bottom, so a branch NEVER reorders against its handles (e.g.
        // FINANCEIRO must stay above OUTRO even when OUTRO's downstream pulls up).
        // Forcing it is now safe because we feed the CORRECT flow order (the DFS
        // walk) — the old tangle came from forcing a messy current-Y order.
        "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
        // Break cycles by following the flow (VoIP loops back to the agent).
        "elk.layered.cycleBreaking.strategy": "DEPTH_FIRST",
        // Straight, balanced columns instead of nodes piling up.
        "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        // Keep disconnected pieces from overlapping each other.
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
    return rel; // never block the canvas on a layout failure
  }
  for (const c of laid.children ?? []) {
    rel.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 });
  }
  return rel;
}

export interface CopilotLayoutInput {
  nodes: Node[];
  edges: Edge[];
  /** IDs of nodes the copilot is adding/changing, ONLY these get repositioned. */
  touchedIds: Set<string>;
}

/**
 * Lay out only the copilot-touched nodes as a left-to-right layered DAG (ELK),
 * then translate the resulting cluster so it flows out of the untouched nodes it
 * connects to. Returns new positions for touched nodes only, never blocks the
 * canvas: on any failure it resolves to an empty map (callers keep prior coords).
 */
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

  // Only edges internal to the touched subgraph drive the layered layout;
  // edges to untouched nodes are used purely for anchoring (below).
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

  // ---- anchor the cluster ------------------------------------------------
  let dx: number;
  let dy: number;

  // 1) untouched → touched: the new nodes continue an existing flow → place the
  //    connected touched node to the RIGHT of its anchor, on the same row.
  const inEdge = edges.find(
    (e) =>
      !touchedIds.has(e.source) && touchedIds.has(e.target) && byId.has(e.source),
  );
  // 2) touched → untouched: the new nodes feed an existing node → place them to
  //    the LEFT of that node.
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
    // No connection to existing nodes, drop the cluster to the right of the
    // untouched bounding box (or at the origin if the canvas is empty).
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

/**
 * Tidy up the ENTIRE workflow (the canvas "Tidy up" button) as a left-to-right
 * layered DAG. Group/decoration nodes are ignored and never moved; the tidied
 * cluster is anchored to the flow's current top-left so the graph stays roughly
 * where it was instead of jumping across the canvas. Returns new positions for
 * flow nodes only (empty map on failure → caller keeps current coordinates).
 */
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

  // Anchor in place: keep the tidied flow's top-left where it currently sits.
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
