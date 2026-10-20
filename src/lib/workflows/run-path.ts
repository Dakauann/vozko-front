import { edgeBranch } from "./edge-branch";

export interface RunPathStep {
  nodeId: string;
  status: string;
  branch?: string;
}

export interface RunPathEdge {
  id: string;
  source: string;
  target: string;
  label?: unknown;
  sourceHandle?: string | null;
}

export interface RunOverlay {
  executedNodeIds: ReadonlySet<string>;
  failedNodeIds: ReadonlySet<string>;
  traversedEdgeIds: ReadonlySet<string>;
}

export type RunNodeMark = "executed" | "failed" | "untouched";

interface RunOverlayInput {
  steps: readonly RunPathStep[];
  edges: readonly RunPathEdge[];
  triggerNodeId?: string;
}

const FAILED_STEP = "failed";

function withTrigger(steps: readonly RunPathStep[], triggerNodeId?: string): readonly RunPathStep[] {
  if (!triggerNodeId || steps.length === 0 || steps[0].nodeId === triggerNodeId) return steps;
  return [{ nodeId: triggerNodeId, status: "executed" }, ...steps];
}

function edgesBySource(edges: readonly RunPathEdge[]): Map<string, RunPathEdge[]> {
  const bySource = new Map<string, RunPathEdge[]>();
  for (const edge of edges) {
    const list = bySource.get(edge.source);
    if (list) list.push(edge);
    else bySource.set(edge.source, [edge]);
  }
  return bySource;
}

function takenEdge(candidates: readonly RunPathEdge[], branch: string | undefined): RunPathEdge {
  if (branch) {
    const onBranch = candidates.find((edge) => edgeBranch(edge) === branch);
    if (onBranch) return onBranch;
  }
  return candidates[0];
}

export function deriveRunOverlay({ steps, edges, triggerNodeId }: RunOverlayInput): RunOverlay {
  const visits = withTrigger(steps, triggerNodeId);
  const bySource = edgesBySource(edges);
  const executedNodeIds = new Set<string>();
  const lastStatus = new Map<string, string>();
  const traversedEdgeIds = new Set<string>();

  visits.forEach((visit, index) => {
    executedNodeIds.add(visit.nodeId);
    lastStatus.set(visit.nodeId, visit.status);
    if (index === 0) return;
    const previous = visits[index - 1];
    if (previous.nodeId === visit.nodeId) return;
    const candidates = (bySource.get(previous.nodeId) ?? []).filter((edge) => edge.target === visit.nodeId);
    if (candidates.length === 0) return;
    traversedEdgeIds.add(takenEdge(candidates, previous.branch).id);
  });

  const failedNodeIds = new Set([...lastStatus].filter(([, status]) => status === FAILED_STEP).map(([nodeId]) => nodeId));
  return { executedNodeIds, failedNodeIds, traversedEdgeIds };
}

export function runNodeMark(overlay: RunOverlay | null, nodeId: string): RunNodeMark | null {
  if (!overlay) return null;
  if (overlay.failedNodeIds.has(nodeId)) return "failed";
  return overlay.executedNodeIds.has(nodeId) ? "executed" : "untouched";
}
