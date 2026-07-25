import type { Edge } from "@xyflow/react";

export function getDomainEdgeLabel(
  edge: Pick<Edge, "sourceHandle" | "label">,
): string | undefined {
  const sourceHandle =
    typeof edge.sourceHandle === "string" ? edge.sourceHandle.trim() : "";
  if (sourceHandle !== "") {
    return sourceHandle;
  }

  const label = typeof edge.label === "string" ? edge.label.trim() : "";
  return label !== "" ? label : undefined;
}