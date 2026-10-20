export interface BranchEdge {
  sourceHandle?: string | null;
  label?: unknown;
}

export function edgeBranch(edge: BranchEdge): string | undefined {
  const sourceHandle = typeof edge.sourceHandle === "string" ? edge.sourceHandle.trim() : "";
  if (sourceHandle !== "") return sourceHandle;
  const label = typeof edge.label === "string" ? edge.label.trim() : "";
  return label !== "" ? label : undefined;
}
