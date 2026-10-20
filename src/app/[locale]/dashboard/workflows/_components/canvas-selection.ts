import type { ReactFlowState } from "@xyflow/react";

export function selectedNodeCount(state: ReactFlowState): number {
  let count = 0;
  for (const node of state.nodes) {
    if (node.selected && ++count > 1) return count;
  }
  return count;
}

export function hasSelectedEdge(state: ReactFlowState): boolean {
  return state.edges.some((edge) => edge.selected);
}
