import { MarkerType, Position, type Connection, type Edge, type Node } from "@xyflow/react";

import type {
  HandleDefinition,
  NodeDefinition,
  WorkflowEdge as WFEdge,
  WorkflowGraph,
  WorkflowNode as WFNode,
  WorkflowNodeType,
  WorkflowType,
} from "@/lib/workflows/types";
import { definitionAllowedForType } from "@/lib/workflows/workflow-types";
import { edgeSourceHandle } from "@/lib/workflows/edge-outputs";
import {
  SEND_FORM_NODE,
  declaredOutputs,
  isSendFormOutput,
  sendFormIncomplete,
  type SendFormOutput,
} from "@/lib/workflows/form-node";

import type { WorkflowNodeData } from "./workflow-node";

export function isNodeTypeAllowedForType(
  wfType: WorkflowType,
  nodeType: WorkflowNodeType,
  defMap: Map<string, NodeDefinition>,
) {
  if (nodeType === "group" || nodeType === "decoration_background") {
    return true;
  }

  return definitionAllowedForType(wfType, defMap.get(nodeType));
}

export interface OutputLabels {
  defaultPath: string;
  textResponse: string;
  noMatch: string;
  error: string;
  form: Record<SendFormOutput, string>;
}

function resolveOutputLabel(
  nodeType: WorkflowNodeType,
  outputId: string,
  labels: OutputLabels,
  fallbackLabel?: string,
): string {
  const normalizedId = outputId.trim().toLowerCase();

  if (nodeType === SEND_FORM_NODE && isSendFormOutput(normalizedId)) return labels.form[normalizedId];

  switch (normalizedId) {
    case "default":
      if (nodeType === "action_ai_agent") return labels.textResponse;
      if (nodeType === "condition_text_match") return labels.noMatch;
      return labels.defaultPath;
    case "erro":
    case "error":
      return labels.error;
    default:
      return fallbackLabel?.trim() || outputId;
  }
}

export function normalizeOutputs(
  nodeType: WorkflowNodeType,
  outputs: HandleDefinition[] | undefined,
  labels: OutputLabels,
): HandleDefinition[] | undefined {
  const declared = declaredOutputs(nodeType, outputs);
  if (!declared?.length) return declared;

  return declared.map((output) => ({
    ...output,
    label: resolveOutputLabel(nodeType, output.id, labels, output.label),
  }));
}

export function checkMissingRequired(
  def: NodeDefinition | undefined,
  config: Record<string, unknown>,
  nodeType?: WorkflowNodeType,
): boolean {
  if (!def?.configSchema) return false;
  const missingGeneric = def.configSchema.some(
    (f) =>
      f.required === true &&
      (config[f.key] === undefined ||
        config[f.key] === null ||
        config[f.key] === ""),
  );
  if (missingGeneric) return true;

  if (nodeType === SEND_FORM_NODE) return sendFormIncomplete(config);

  if (nodeType === "action_ai_agent") {
    const source = config.source as string;
    if (source === "prompt") {
      return !config.model || !config.instructions;
    }
    return !config.agent_id;
  }

  return false;
}

export function workflowFlowNode({
  id,
  nodeType,
  position,
  config,
  label,
  icon,
  def,
  outputLabels,
}: {
  id: string;
  nodeType: WorkflowNodeType;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  label?: string;
  icon?: string;
  def: NodeDefinition | undefined;
  outputLabels: OutputLabels;
}): Node {
  return {
    id,
    type: "workflowNode",
    position,
    targetPosition: Position.Left,
    sourcePosition: Position.Right,
    data: {
      nodeType,
      config,
      label,
      icon,
      outputs: normalizeOutputs(nodeType, def?.outputs, outputLabels),
      hasMissingRequired: checkMissingRequired(def, config, nodeType),
    } satisfies WorkflowNodeData,
  };
}

export function domainToFlow(
  graph: WorkflowGraph | undefined,
  defMap: Map<string, NodeDefinition>,
  outputLabels: OutputLabels,
  handlesByNode: Record<string, HandleDefinition[]> = {},
): { nodes: Node[]; edges: Edge[] } {
  if (!graph) return { nodes: [], edges: [] };
  const handleIdsByNode = new Map<string, string[]>();
  const nodes: Node[] = (graph.nodes ?? []).map((n: WFNode) => {
    if (n.type === "group" || n.type === "decoration_background") {
      const cfg = n.config ?? {};
      const w = (cfg._width as number) || 400;
      const h = (cfg._height as number) || 250;
      return {
        id: n.id,
        type: "groupNode",
        position: n.position,
        width: w,
        height: h,
        style: { width: w, height: h },
        zIndex: -1,
        data: {
          nodeType: "group" as WorkflowNodeType,
          config: cfg,
          label: (cfg.display_name as string) || "Grupo",
        } satisfies WorkflowNodeData,
      };
    }

    const def = defMap.get(n.type);
    const outputs = normalizeOutputs(
      n.type,
      handlesByNode[n.id] ?? def?.outputs,
      outputLabels,
    );
    handleIdsByNode.set(n.id, (outputs ?? []).map((o) => o.id));
    return {
      id: n.id,
      type: "workflowNode",
      position: n.position,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      data: {
        nodeType: n.type,
        config: n.config ?? {},
        label: (n.config?.display_name as string) || def?.label,
        icon: def?.icon,
        outputs,
        hasMissingRequired: checkMissingRequired(def, n.config ?? {}, n.type),
        ...(n.pinned ? { pinned: n.pinned } : {}),
      } satisfies WorkflowNodeData,
    };
  });
  const edges: Edge[] = (graph.edges ?? []).map((e: WFEdge, i: number) => {
    const sourceHandle = edgeSourceHandle(e.label, handleIdsByNode.get(e.source) ?? []);
    return {
      id: `e-${e.source}-${e.target}-${i}`,
      source: e.source,
      target: e.target,
      sourceHandle,
      label: e.label ?? undefined,
      type: "smartBezier",
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      style: { strokeWidth: 1.5 },
    };
  });
  return { nodes, edges };
}

export function reconnectedEdges(edges: Edge[], previous: Edge, connection: Connection): Edge[] {
  return edges.map((edge) =>
    edge.id === previous.id
      ? {
          ...edge,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
          label: connection.sourceHandle || undefined,
        }
      : edge,
  );
}

export function copilotNodeSig(data: unknown): string {
  const d = (data ?? {}) as { config?: unknown; label?: unknown };
  return JSON.stringify({ c: d.config ?? null, l: d.label ?? null });
}
