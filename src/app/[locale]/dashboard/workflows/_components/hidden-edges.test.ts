import { describe, expect, it } from "vitest";

import { missingOutputHandles } from "@/lib/workflows/edge-outputs";
import type { HandleDefinition, NodeDefinition, WorkflowGraph } from "@/lib/workflows/types";

import { domainToFlow, reconnectedEdges, type OutputLabels } from "./editor-flow";
import type { WorkflowNodeData } from "./workflow-node";

const LABELS: OutputLabels = {
  defaultPath: "Padrão",
  textResponse: "Resposta",
  noMatch: "Sem correspondência",
  error: "Erro",
  form: { completed: "Respondeu", no_reply: "Não respondeu", send_failed: "Falha no envio" },
};

const N27_CANONICAL_CONFIG = {
  body: "Valores dos Materiais para aulas aquáticas:",
  sections:
    '[{"title":"Aulas Aquáticas","rows":[{"id":"1","title":"Horários Aquáticas 🏊‍♀️","description":""},{"id":"2","title":"Materiais Aquáticos 🥽","description":""}]}]',
  list_button: "Escolha uma opção",
  interactive_type: "list",
};

const N27_HANDLES_FROM_THE_SERVER: HandleDefinition[] = [
  { id: "1", label: "Horários Aquáticas 🏊‍♀️" },
  { id: "2", label: "Materiais Aquáticos 🥽" },
  { id: "no_match", label: "Sem correspondência", optional: true },
  { id: "no_reply", label: "Não respondeu", optional: true },
  { id: "send_failed", label: "Falha no envio", optional: true },
];

const WORKFLOW_7342AC13: WorkflowGraph = {
  nodes: [
    { id: "n27", type: "action_send_interactive", config: N27_CANONICAL_CONFIG, position: { x: 5096, y: 1186 } },
    { id: "n44", type: "wait_duration", config: { seconds: 1 }, position: { x: 5484, y: 844 } },
    { id: "n28", type: "wait_duration", config: { seconds: 1 }, position: { x: 5484, y: 1044 } },
  ],
  edges: [
    { source: "n27", target: "n28", label: "2" },
    { source: "n27", target: "n44", label: "1" },
  ],
} as WorkflowGraph;

function outputIdsOf(nodes: ReturnType<typeof domainToFlow>["nodes"], id: string): string[] {
  const data = nodes.find((n) => n.id === id)?.data as unknown as WorkflowNodeData;
  return (data.outputs ?? []).map((o) => o.id);
}

describe("workflow 7342ac13, node n27", () => {
  it("takes its outputs 1 and 2 from the server and draws both edges from them", () => {
    const { nodes, edges } = domainToFlow(WORKFLOW_7342AC13, new Map(), LABELS, { n27: N27_HANDLES_FROM_THE_SERVER });
    const outputs = outputIdsOf(nodes, "n27");

    expect(outputs).toEqual(["1", "2", "no_match", "no_reply", "send_failed"]);
    expect(edges.map((e) => [e.target, e.sourceHandle])).toEqual([
      ["n28", "2"],
      ["n44", "1"],
    ]);
    expect(missingOutputHandles(outputs, edges.map((e) => e.sourceHandle))).toEqual([]);
  });

  it("never invents outputs from the config: without the server's answer both edges show as missing", () => {
    const { nodes, edges } = domainToFlow(WORKFLOW_7342AC13, new Map(), LABELS);

    expect(outputIdsOf(nodes, "n27")).toEqual([]);
    expect(missingOutputHandles(outputIdsOf(nodes, "n27"), edges.map((e) => e.sourceHandle))).toEqual(["2", "1"]);
  });

  it("shows an edge from an option the server no longer lists as missing instead of hiding it", () => {
    const withoutRowTwo = N27_HANDLES_FROM_THE_SERVER.filter((h) => h.id !== "2");
    const { nodes, edges } = domainToFlow(WORKFLOW_7342AC13, new Map(), LABELS, { n27: withoutRowTwo });

    expect(missingOutputHandles(outputIdsOf(nodes, "n27"), edges.map((e) => e.sourceHandle))).toEqual(["2"]);
  });
});

describe("edges from a node with a single unnamed output", () => {
  it("attach a default label to that output instead of hiding the edge", () => {
    const definitions = new Map<string, NodeDefinition>([["action_send_text", { type: "action_send_text", outputs: [] } as unknown as NodeDefinition]]);
    const graph = {
      nodes: [
        { id: "a", type: "action_send_text", config: {}, position: { x: 0, y: 0 } },
        { id: "b", type: "action_send_text", config: {}, position: { x: 0, y: 0 } },
      ],
      edges: [{ source: "a", target: "b", label: "default" }],
    } as WorkflowGraph;

    expect(domainToFlow(graph, definitions, LABELS).edges[0].sourceHandle).toBeUndefined();
  });
});

describe("reconnecting an edge from a missing output", () => {
  it("moves it to the chosen output and relabels it, keeping its id", () => {
    const { edges } = domainToFlow(WORKFLOW_7342AC13, new Map(), LABELS);
    const stale = edges[0];

    const next = reconnectedEdges(edges, stale, { source: "n27", target: "n44", sourceHandle: "1", targetHandle: null });

    expect(next[0]).toMatchObject({ id: stale.id, source: "n27", target: "n44", sourceHandle: "1", label: "1" });
    expect(next[1]).toBe(edges[1]);
  });
});
