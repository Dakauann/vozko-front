"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  useNodesState,
  type Edge,
  type Node,
  type NodeTypes,
  type EdgeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useTranslations } from "next-intl";

import { ArrowLeft } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import { versionTag } from "@/lib/workflows/publication";
import { deriveRunOverlay, type RunPathStep } from "@/lib/workflows/run-path";
import type { WorkflowGraph } from "@/lib/workflows/types";

import { withRunPath } from "./edge-activity";
import { buildObstacleIndex } from "./edge-routing";
import { createRunOverlayStore, RunOverlayContext } from "./run-overlay";
import { ObstacleIndexContext } from "./smart-edge";
import { EntryPointsContext } from "./trigger-entry-mark";

export interface VersionFocus {
  nodeId: string;
  seq: number;
}

const FIT_VIEW_OPTIONS = { padding: 0.2, maxZoom: 1 };

export function VersionRunCanvas({
  version,
  graph,
  toFlow,
  steps,
  triggerNodeId,
  focus,
  nodeTypes,
  edgeTypes,
  onBack,
}: {
  version: number;
  graph: WorkflowGraph;
  toFlow: (graph: WorkflowGraph) => { nodes: Node[]; edges: Edge[] };
  steps: readonly RunPathStep[];
  triggerNodeId?: string;
  focus: VersionFocus | null;
  nodeTypes: NodeTypes;
  edgeTypes: EdgeTypes;
  onBack: () => void;
}) {
  const t = useTranslations("workflowDebug.versionView");
  const flow = useMemo(() => toFlow(graph), [toFlow, graph]);
  const [nodes, , onNodesChange] = useNodesState(flow.nodes);
  const [overlayStore] = useState(createRunOverlayStore);
  const instanceRef = useRef<ReactFlowInstance | null>(null);
  const obstacleIndex = useMemo(() => buildObstacleIndex(nodes), [nodes]);
  const overlay = useMemo(() => deriveRunOverlay({ steps, edges: flow.edges, triggerNodeId }), [steps, flow.edges, triggerNodeId]);
  const edges = useMemo(() => withRunPath(flow.edges, overlay.traversedEdgeIds), [flow.edges, overlay]);

  useEffect(() => {
    overlayStore.set(overlay);
  }, [overlay, overlayStore]);

  useEffect(() => {
    if (!focus) return;
    const node = instanceRef.current?.getNode(focus.nodeId);
    if (!node || !instanceRef.current) return;
    instanceRef.current.setCenter(node.position.x + (node.measured?.width ?? 220) / 2, node.position.y + (node.measured?.height ?? 120) / 2, {
      zoom: Math.max(instanceRef.current.getZoom(), 0.9),
      duration: 450,
    });
  }, [focus]);

  return (
    <EntryPointsContext.Provider value={null}>
    <ObstacleIndexContext.Provider value={obstacleIndex}>
      <RunOverlayContext.Provider value={overlayStore}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onInit={(instance) => {
            instanceRef.current = instance;
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          deleteKeyCode={null}
          fitView
          fitViewOptions={FIT_VIEW_OPTIONS}
          minZoom={0.2}
          maxZoom={1.75}
          onlyRenderVisibleElements
          aria-label={t("banner", { version: versionTag(version) })}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--border-strong))" />
          <Controls showInteractive={false} className="!bg-background !border-border !shadow-md [&>button]:!bg-background [&>button]:!border-border [&>button]:!fill-foreground" />
          <Panel position="top-center">
            <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-1.5 shadow-sm">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-xs font-medium text-foreground">{t("banner", { version: versionTag(version) })}</span>
              <ElevatedButton variant="ghost" size="sm" iconVisible icon={<ArrowLeft size={12} />} title={t("back")} onClick={onBack} />
            </div>
          </Panel>
        </ReactFlow>
      </RunOverlayContext.Provider>
    </ObstacleIndexContext.Provider>
    </EntryPointsContext.Provider>
  );
}
