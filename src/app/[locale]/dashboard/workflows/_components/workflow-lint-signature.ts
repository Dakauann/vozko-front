import type { WorkflowGraph } from "@/lib/workflows/types";

// A stable, POSITION-AGNOSTIC fingerprint of everything the lint depends on:
// the workflow type, each node's id/type/config, and the edge wiring. Node
// positions are deliberately excluded so dragging a node around never triggers
// a network re-lint (layout has no effect on validity). Edges are sorted so a
// reorder of the same wiring produces the same signature.
//
// Lives in its own module (no server-action imports) so it is unit-testable in
// isolation from the debounced hook that consumes it.
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
