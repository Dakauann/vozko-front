import type { Edge, Node } from "@xyflow/react";

import { edgeBranch } from "@/lib/workflows/edge-branch";
import { pinSignature } from "@/lib/workflows/node-pin";
import type { Workflow, WorkflowGraph, WorkflowNodeType, WorkflowType } from "@/lib/workflows/types";
import { workflowTypeOfTrigger } from "@/lib/workflows/workflow-types";

import type { WorkflowNodeData } from "./workflow-node";

export const getDomainEdgeLabel: (edge: Pick<Edge, "sourceHandle" | "label">) => string | undefined = edgeBranch;

export function flowToDomain(nodes: readonly Node[], edges: readonly Edge[]): WorkflowGraph {
  return {
    nodes: nodes.map((n) => {
      const data = n.data as unknown as WorkflowNodeData;
      const config = sanitizeWorkflowConfig(data.config ?? {});
      if (data.nodeType === "group") {
        const w =
          (n as Record<string, unknown>).width ??
          (n.measured as { width?: number } | undefined)?.width ??
          (n.style as Record<string, unknown> | undefined)?.width;
        const h =
          (n as Record<string, unknown>).height ??
          (n.measured as { height?: number } | undefined)?.height ??
          (n.style as Record<string, unknown> | undefined)?.height;
        if (w) config._width = Number(w);
        if (h) config._height = Number(h);
      }
      return {
        id: n.id,
        type: (data.nodeType === "group"
          ? "decoration_background"
          : data.nodeType) as WorkflowNodeType,
        position: { x: n.position.x, y: n.position.y },
        config,
        ...(data.pinned ? { pinned: data.pinned } : {}),
      };
    }),
    edges: edges.map((e) => ({
      source: e.source,
      target: e.target,
      label: getDomainEdgeLabel(e),
    })),
  };
}

function sanitizeWorkflowValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeWorkflowValue);
  }

  if (value && typeof value === "object") {
    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !key.startsWith("_display_"))
      .map(
        ([key, entryValue]) =>
          [key, sanitizeWorkflowValue(entryValue)] as const,
      )
      .sort(([left], [right]) => left.localeCompare(right));

    return Object.fromEntries(sortedEntries);
  }

  return value;
}

function sanitizeWorkflowConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = sanitizeWorkflowValue(config);
  return sanitized && typeof sanitized === "object"
    ? (sanitized as Record<string, unknown>)
    : {};
}

function normalizeGraphForDirtyCheck(graph: WorkflowGraph): WorkflowGraph {
  return {
    nodes: [...(graph.nodes ?? [])]
      .map(({ pinned, ...node }) => ({
        ...node,
        config: sanitizeWorkflowConfig(node.config ?? {}),
        pin: pinSignature(pinned),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...(graph.edges ?? [])].sort((left, right) => {
      const leftKey = `${left.source}:${left.label ?? ""}:${left.target}`;
      const rightKey = `${right.source}:${right.label ?? ""}:${right.target}`;
      return leftKey.localeCompare(rightKey);
    }),
  };
}

export function createWorkflowSnapshot(input: {
  name: string;
  description: string;
  workflowType: WorkflowType;
  graph: WorkflowGraph;
}) {
  return JSON.stringify({
    name: input.name,
    description: input.description,
    workflowType: input.workflowType,
    graph: normalizeGraphForDirtyCheck(input.graph),
  });
}

export function workflowDraftSnapshot(workflow: Pick<Workflow, "name" | "description" | "type" | "triggerType" | "graph">): string {
  return createWorkflowSnapshot({
    name: workflow.name ?? "",
    description: workflow.description ?? "",
    workflowType: workflow.type ?? (workflow.triggerType ? workflowTypeOfTrigger(workflow.triggerType) : "messages"),
    graph: workflow.graph,
  });
}
