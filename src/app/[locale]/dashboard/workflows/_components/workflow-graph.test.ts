import { describe, expect, it } from "vitest";

import type { Node } from "@xyflow/react";

import type { WorkflowGraph } from "@/lib/workflows/types";

import { createWorkflowSnapshot, flowToDomain, getDomainEdgeLabel, workflowDraftSnapshot } from "./workflow-graph";

describe("getDomainEdgeLabel", () => {
  it("returns undefined for unlabeled edges", () => {
    expect(getDomainEdgeLabel({ sourceHandle: undefined, label: undefined })).toBeUndefined();
    expect(getDomainEdgeLabel({ sourceHandle: "", label: "" })).toBeUndefined();
  });

  it("prefers the source handle when present", () => {
    expect(getDomainEdgeLabel({ sourceHandle: "success", label: "ignored" })).toBe("success");
  });

  it("falls back to the visible label when no source handle exists", () => {
    expect(getDomainEdgeLabel({ sourceHandle: undefined, label: "erro" })).toBe("erro");
  });
});
describe("pinned outputs in the draft graph", () => {
  const pin = { output: { status_code: 200 }, edge: "success", source: "simulation", pinned_at: "2026-10-20T12:00:00.000Z" };
  const flowNode = (pinned?: typeof pin): Node => ({
    id: "n1",
    type: "workflowNode",
    position: { x: 0, y: 0 },
    data: { nodeType: "action_http_request", config: { url: "https://x" }, ...(pinned ? { pinned } : {}) },
  });

  it("saves the pin with the node, so the normal draft save stores it", () => {
    expect(flowToDomain([flowNode(pin)], [])).toEqual({
      nodes: [{ id: "n1", type: "action_http_request", position: { x: 0, y: 0 }, config: { url: "https://x" }, pinned: pin }],
      edges: [],
    });
  });

  it("sends no pinned field for a node without a pin", () => {
    expect("pinned" in flowToDomain([flowNode()], []).nodes[0]).toBe(false);
  });

  it("reads a pin as a change until it is saved", () => {
    const snapshot = (pinned?: typeof pin) =>
      createWorkflowSnapshot({ name: "f", description: "", workflowType: "messages", graph: flowToDomain([flowNode(pinned)], []) });
    expect(snapshot(pin)).not.toBe(snapshot());
  });

  it("reads the pin the server sends back after the save as unchanged", () => {
    const local = flowToDomain([flowNode(pin)], []);
    const server: WorkflowGraph = {
      nodes: [{ ...local.nodes[0], pinned: { ...pin, pinned_at: "2026-10-20T12:00:00Z", output: { status_code: 200 } } }],
      edges: [],
    };
    const snapshot = (graph: WorkflowGraph) => createWorkflowSnapshot({ name: "f", description: "", workflowType: "messages", graph });
    expect(snapshot(server)).toBe(snapshot(local));
  });
});

describe("workflowDraftSnapshot", () => {
  const graph: WorkflowGraph = { nodes: [], edges: [] };

  it("reads a stored draft the same way the editor reads its canvas", () => {
    expect(workflowDraftSnapshot({ name: "Matrícula", description: "d", type: "voice", graph })).toBe(
      createWorkflowSnapshot({ name: "Matrícula", description: "d", workflowType: "voice", graph }),
    );
  });

  it("derives the type from the trigger of an older workflow without a type", () => {
    expect(workflowDraftSnapshot({ name: "Ligação", triggerType: "trigger_call_received", graph } as Parameters<typeof workflowDraftSnapshot>[0])).toBe(
      createWorkflowSnapshot({ name: "Ligação", description: "", workflowType: "voice", graph }),
    );
  });
});
