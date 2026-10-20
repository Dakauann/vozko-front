"use client";

import { useEffect, useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";

import { deriveRunOverlay, type RunPathStep } from "@/lib/workflows/run-path";
import type { RunDetail, WorkflowRunLog } from "@/lib/workflows/types";

import { withRunPath } from "./edge-activity";
import type { RunOverlayStore } from "./run-overlay";
import type { WorkflowNodeData } from "./workflow-node";

interface CanvasRunOverlayInput {
  shownRun: RunDetail | null;
  testOpen: boolean;
  simulationSteps: readonly RunPathStep[];
  simulationTriggerType: string | null | undefined;
  nodeTestPath: WorkflowRunLog[] | null;
  structureNodes: Node[];
  edgeStructure: Edge[];
  edges: Edge[];
  store: RunOverlayStore;
}

export function useCanvasRunOverlay({
  shownRun,
  testOpen,
  simulationSteps,
  simulationTriggerType,
  nodeTestPath,
  structureNodes,
  edgeStructure,
  edges,
  store,
}: CanvasRunOverlayInput): Edge[] {
  const simTriggerNodeId = useMemo(
    () =>
      simulationTriggerType
        ? structureNodes.find((n) => (n.data as unknown as WorkflowNodeData)?.nodeType === simulationTriggerType)?.id
        : undefined,
    [simulationTriggerType, structureNodes],
  );
  const overlaySource = useMemo((): { steps: readonly RunPathStep[]; triggerNodeId?: string } | null => {
    if (shownRun) return { steps: shownRun.logs, triggerNodeId: shownRun.run.triggerNodeId };
    if (testOpen && simulationSteps.length > 0) return { steps: simulationSteps, triggerNodeId: simTriggerNodeId };
    if (nodeTestPath) return { steps: nodeTestPath };
    return null;
  }, [shownRun, testOpen, simulationSteps, simTriggerNodeId, nodeTestPath]);
  const runOverlay = useMemo(
    () =>
      overlaySource
        ? deriveRunOverlay({ steps: overlaySource.steps, edges: edgeStructure, triggerNodeId: overlaySource.triggerNodeId })
        : null,
    [overlaySource, edgeStructure],
  );
  useEffect(() => {
    store.set(runOverlay);
  }, [runOverlay, store]);
  return useMemo(
    () => (runOverlay ? withRunPath(edges, runOverlay.traversedEdgeIds) : edges),
    [edges, runOverlay],
  );
}
