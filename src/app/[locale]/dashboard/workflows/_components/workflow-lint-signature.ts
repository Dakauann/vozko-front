import { pinSignature } from "@/lib/workflows/node-pin";
import { testInputsSignature } from "@/lib/workflows/test-inputs";
import type { WorkflowGraph } from "@/lib/workflows/types";

export function lintSignature(type: string, graph: WorkflowGraph): string {
  return JSON.stringify({
    t: type,
    n: (graph.nodes ?? []).map((node) => ({
      i: node.id,
      y: node.type,
      c: node.config ?? {},
      p: pinSignature(node.pinned),
      s: testInputsSignature(node.testInputs),
    })),
    e: (graph.edges ?? [])
      .map((edge) => `${edge.source}>${edge.label ?? ""}>${edge.target}`)
      .sort(),
  });
}
