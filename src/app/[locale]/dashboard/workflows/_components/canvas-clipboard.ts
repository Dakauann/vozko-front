import type { Edge, Node, XYPosition } from "@xyflow/react";

import { nextShortNodeId } from "@/lib/workflows/node-ids";
import type { NodeDefinition, WorkflowNodeType } from "@/lib/workflows/types";

import { workflowFlowNode, type OutputLabels } from "./editor-flow";
import type { WorkflowNodeData } from "./workflow-node";

const WORKFLOW_NODE = "workflowNode";

export interface CopiedNode {
  id: string;
  nodeType: WorkflowNodeType;
  config: Record<string, unknown>;
  label?: string;
  icon?: string;
  position: XYPosition;
}

export interface CanvasClipboard {
  nodes: CopiedNode[];
  edges: Edge[];
}

export interface PasteTarget {
  anchor: XYPosition;
  takenIds: Iterable<string>;
  defMap: Map<string, NodeDefinition>;
  outputLabels: OutputLabels;
}

export function copiedSelection(nodes: readonly Node[], edges: readonly Edge[], copyable: (nodeType: WorkflowNodeType) => boolean): CanvasClipboard | null {
  const copied = nodes.flatMap((node): CopiedNode[] => {
    const data = node.data as unknown as WorkflowNodeData;
    if (!node.selected || node.type !== WORKFLOW_NODE || !copyable(data.nodeType)) return [];
    return [{ id: node.id, nodeType: data.nodeType, config: structuredClone(data.config ?? {}), label: data.label, icon: data.icon, position: { ...node.position } }];
  });
  if (copied.length === 0) return null;
  const ids = new Set(copied.map((node) => node.id));
  return { nodes: copied, edges: edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map((edge) => ({ ...edge })) };
}

function freshIds(nodes: readonly CopiedNode[], takenIds: Iterable<string>): Map<string, string> {
  const taken = new Set(takenIds);
  const ids = new Map<string, string>();
  for (const node of nodes) {
    const id = nextShortNodeId(taken);
    taken.add(id);
    ids.set(node.id, id);
  }
  return ids;
}

export function pastedSelection(clipboard: CanvasClipboard, { anchor, takenIds, defMap, outputLabels }: PasteTarget): { nodes: Node[]; edges: Edge[] } {
  const ids = freshIds(clipboard.nodes, takenIds);
  const left = Math.min(...clipboard.nodes.map((node) => node.position.x));
  const top = Math.min(...clipboard.nodes.map((node) => node.position.y));
  const nodes = clipboard.nodes.map((node) => ({
    ...workflowFlowNode({
      id: ids.get(node.id)!,
      nodeType: node.nodeType,
      position: { x: anchor.x + node.position.x - left, y: anchor.y + node.position.y - top },
      config: structuredClone(node.config),
      label: node.label,
      icon: node.icon,
      def: defMap.get(node.nodeType),
      outputLabels,
    }),
    selected: true,
  }));
  const edges = clipboard.edges.map((edge, index) => {
    const source = ids.get(edge.source)!;
    const target = ids.get(edge.target)!;
    return { ...edge, id: `e-${source}-${target}-${index}`, source, target, selected: false };
  });
  return { nodes, edges };
}
