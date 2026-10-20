import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import type { NodeDefinition } from "@/lib/workflows/types";

import { copiedSelection, pastedSelection } from "./canvas-clipboard";
import type { OutputLabels } from "./editor-flow";
import type { WorkflowNodeData } from "./workflow-node";

const PIN = { output: { ok: true }, source: "manual", pinned_at: "2026-10-20T10:00:00Z" };

function node(id: string, x: number, y: number, overrides: Partial<Node> = {}, data: Partial<WorkflowNodeData> = {}): Node {
  return {
    id,
    type: "workflowNode",
    position: { x, y },
    selected: true,
    data: { nodeType: "action_send_message", config: { message: `texto ${id}`, nested: { list: [1, 2] } }, label: `Passo ${id}`, icon: "ChatText", ...data },
    ...overrides,
  };
}

function edge(source: string, target: string, sourceHandle: string | null = null): Edge {
  return { id: `e-${source}-${target}`, source, target, sourceHandle, label: sourceHandle ?? undefined, type: "smartBezier", selected: true };
}

const everyType = () => true;
const DEF_MAP = new Map<string, NodeDefinition>();
const OUTPUT_LABELS: OutputLabels = {
  defaultPath: "Seguir",
  textResponse: "Resposta",
  noMatch: "Sem correspondência",
  error: "Erro",
  form: { completed: "Respondido", no_reply: "Sem resposta", send_failed: "Falha no envio" },
};

function paste(nodes: Node[], edges: Edge[], takenIds: string[] = nodes.map((n) => n.id)) {
  const clipboard = copiedSelection(nodes, edges, everyType);
  if (!clipboard) throw new Error("nothing copied");
  return pastedSelection(clipboard, { anchor: { x: 1000, y: 500 }, takenIds, defMap: DEF_MAP, outputLabels: OUTPUT_LABELS });
}

describe("copiedSelection", () => {
  it("copies every selected node and only the edges between them", () => {
    const nodes = [node("n1", 0, 0), node("n2", 300, 0), node("n3", 600, 0, { selected: false })];
    const clipboard = copiedSelection(nodes, [edge("n1", "n2", "sucesso"), edge("n2", "n3")], everyType);
    expect(clipboard?.nodes.map((entry) => entry.id)).toEqual(["n1", "n2"]);
    expect(clipboard?.edges.map((entry) => `${entry.source}>${entry.target}`)).toEqual(["n1>n2"]);
  });

  it("leaves out the nodes that may exist only once and the groups", () => {
    const nodes = [node("t1", 0, 0, {}, { nodeType: "trigger_webhook" }), node("g1", 0, 0, { type: "groupNode" }, { nodeType: "group" }), node("n2", 300, 0)];
    const clipboard = copiedSelection(nodes, [edge("t1", "n2")], (nodeType) => nodeType !== "trigger_webhook");
    expect(clipboard?.nodes.map((entry) => entry.id)).toEqual(["n2"]);
    expect(clipboard?.edges).toEqual([]);
  });

  it("copies nothing when no copyable node is selected", () => {
    expect(copiedSelection([node("n1", 0, 0, { selected: false })], [], everyType)).toBeNull();
  });

  it("keeps a copy of the config that later edits to the original do not reach", () => {
    const original = node("n1", 0, 0);
    const clipboard = copiedSelection([original], [], everyType);
    ((original.data as unknown as WorkflowNodeData).config.nested as { list: number[] }).list.push(3);
    expect(clipboard?.nodes[0].config).toEqual({ message: "texto n1", nested: { list: [1, 2] } });
  });
});

describe("pastedSelection", () => {
  it("gives every pasted node a fresh id and remaps the internal edges to the new ids", () => {
    const { nodes, edges } = paste([node("n1", 0, 0), node("n2", 300, 0)], [edge("n1", "n2", "sucesso")], ["n1", "n2", "n7"]);
    expect(nodes.map((entry) => entry.id)).toEqual(["n8", "n9"]);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ source: "n8", target: "n9", sourceHandle: "sucesso", label: "sucesso" });
    expect(edges[0].id).not.toBe("e-n1-n2");
  });

  it("keeps the layout of the copied nodes and places it at the pointer", () => {
    const { nodes } = paste([node("n1", 100, 40), node("n2", 400, 140)], []);
    expect(nodes.map((entry) => entry.position)).toEqual([
      { x: 1000, y: 500 },
      { x: 1300, y: 600 },
    ]);
  });

  it("keeps the config, label and icon of each node", () => {
    const { nodes } = paste([node("n1", 0, 0)], []);
    expect(nodes[0].data).toMatchObject({ nodeType: "action_send_message", config: { message: "texto n1", nested: { list: [1, 2] } }, label: "Passo n1", icon: "ChatText" });
  });

  it("strips the pinned output, since pins are draft only test data that publish strips too", () => {
    const { nodes } = paste([node("n1", 0, 0, {}, { pinned: PIN })], []);
    expect((nodes[0].data as unknown as WorkflowNodeData).pinned).toBeUndefined();
  });

  it("selects the pasted nodes alone, so they can be moved together right away", () => {
    const { nodes, edges } = paste([node("n1", 0, 0), node("n2", 300, 0)], [edge("n1", "n2")]);
    expect(nodes.every((entry) => entry.selected)).toBe(true);
    expect(edges.every((entry) => !entry.selected)).toBe(true);
  });

  it("pastes the same clipboard twice with different ids each time", () => {
    const original = [node("n1", 0, 0)];
    const clipboard = copiedSelection(original, [], everyType)!;
    const first = pastedSelection(clipboard, { anchor: { x: 0, y: 0 }, takenIds: ["n1"], defMap: DEF_MAP, outputLabels: OUTPUT_LABELS });
    const second = pastedSelection(clipboard, { anchor: { x: 0, y: 0 }, takenIds: ["n1", ...first.nodes.map((entry) => entry.id)], defMap: DEF_MAP, outputLabels: OUTPUT_LABELS });
    expect(first.nodes[0].id).not.toBe(second.nodes[0].id);
    expect(first.nodes[0].data).not.toBe(second.nodes[0].data);
  });
});
