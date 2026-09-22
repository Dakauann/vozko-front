import type { WorkflowGraph } from "@/lib/workflows/types";

export function lintSignature(type: string, graph: WorkflowGraph): string {
  return JSON.stringify({
    t: type,
    n: (graph.nodes ?? []).map((node) => ({
      i: node.id,
      y: node.type,
      c: node.config ?? {},
    })),
    e: (graph.edges ?? [])
      .map((edge) => `${edge.source}>${edge.label ?? ""}>${edge.target}`)
      .sort(),
  });
}
