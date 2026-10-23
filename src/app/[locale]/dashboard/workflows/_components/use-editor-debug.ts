"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Edge, Node } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { SimStep, UseWorkflowSimulationReturn } from "@/hooks/use-workflow-simulation";
import { liveBreakpoints, toggleBreakpoint } from "@/lib/workflows/breakpoints";
import type { NodeDebugMarks } from "@/lib/workflows/debug-marks";
import type { RightPanel } from "@/lib/workflows/editor-docking";
import { pinEdgeOptions, pinFromStep, type NodePin } from "@/lib/workflows/node-pin";
import { isLiveSimStatus } from "@/lib/workflows/sim-session";
import { withNodeTestInputs, type TriggerTestInput } from "@/lib/workflows/test-inputs";
import type { WorkflowRunLog } from "@/lib/workflows/types";

import type { NodeDebugStore } from "./node-debug-marks";
import type { NodeDebugControls } from "./node-debug-section";
import { useStableValue } from "./use-stable-value";
import { getDomainEdgeLabel } from "./workflow-graph";
import type { WorkflowNodeData } from "./workflow-node";

const NO_NODE_IDS: ReadonlySet<string> = new Set();

type TestInputsByNode = ReadonlyMap<string, TriggerTestInput[]>;

function testInputsByNode(nodes: readonly Node[]): TestInputsByNode {
  return new Map(
    nodes.flatMap((node): Array<[string, TriggerTestInput[]]> => {
      const scenarios = (node.data as unknown as WorkflowNodeData).testInputs;
      return scenarios?.length ? [[node.id, scenarios]] : [];
    }),
  );
}

function sameTestInputsByNode(prev: TestInputsByNode, next: TestInputsByNode): boolean {
  if (prev.size !== next.size) return false;
  for (const [nodeId, scenarios] of next) if (prev.get(nodeId) !== scenarios) return false;
  return true;
}

interface EditorDebugInput {
  simulation: UseWorkflowSimulationReturn;
  testOpen: boolean;
  setTestOpen: Dispatch<SetStateAction<boolean>>;
  setRightPreferred: Dispatch<SetStateAction<RightPanel>>;
  setConfigNodeId: Dispatch<SetStateAction<string | null>>;
  structureNodes: Node[];
  latestEdgesRef: RefObject<Edge[]>;
  centreOnNode: (nodeId: string) => boolean;
  takeSnapshot: () => void;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  debugStore: NodeDebugStore;
  isWorkflowDirty: boolean;
  showNodeTestPath: (steps: WorkflowRunLog[]) => void;
}

export function useEditorDebug({
  simulation,
  testOpen,
  setTestOpen,
  setRightPreferred,
  setConfigNodeId,
  structureNodes,
  latestEdgesRef,
  centreOnNode,
  takeSnapshot,
  setNodes,
  debugStore,
  isWorkflowDirty,
  showNodeTestPath,
}: EditorDebugInput) {
  const tDebug = useTranslations("workflowDebug");
  const [breakpoints, setBreakpoints] = useState<ReadonlySet<string>>(NO_NODE_IDS);

  const nodeIdSet = useMemo(() => new Set(structureNodes.map((n) => n.id)), [structureNodes]);
  const breakpointList = useMemo(() => liveBreakpoints(breakpoints, nodeIdSet), [breakpoints, nodeIdSet]);
  const breakpointKey = breakpointList.join(",");
  const liveBreakpointSet = useMemo(() => new Set(breakpointKey ? breakpointKey.split(",") : []), [breakpointKey]);
  const { setBreakpoints: sendBreakpoints } = simulation;
  useEffect(() => {
    sendBreakpoints(breakpointKey ? breakpointKey.split(",") : []);
  }, [breakpointKey, sendBreakpoints]);

  const realCallSet = useMemo(
    () => (testOpen ? new Set(simulation.realCallNodes) : NO_NODE_IDS),
    [testOpen, simulation.realCallNodes],
  );
  const pausedNodeId = testOpen ? (simulation.pause?.nodeId ?? null) : null;
  const activeSimNodeId =
    testOpen && isLiveSimStatus(simulation.status) && simulation.status !== "paused" ? simulation.currentNodeId : null;
  const debugMarks = useMemo<NodeDebugMarks>(
    () => ({ breakpoints: liveBreakpointSet, realCalls: realCallSet, pausedNodeId, activeNodeId: activeSimNodeId }),
    [liveBreakpointSet, realCallSet, pausedNodeId, activeSimNodeId],
  );
  useEffect(() => {
    debugStore.set(debugMarks);
  }, [debugMarks, debugStore]);

  useEffect(() => {
    if (pausedNodeId) centreOnNode(pausedNodeId);
  }, [pausedNodeId, centreOnNode]);

  const updateNodeData = useCallback(
    (nodeId: string, update: (data: WorkflowNodeData) => WorkflowNodeData) => {
      takeSnapshot();
      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: update(n.data as unknown as WorkflowNodeData) } : n)));
    },
    [setNodes, takeSnapshot],
  );

  const setNodePin = useCallback(
    (nodeId: string, pin: NodePin | null) =>
      updateNodeData(nodeId, (current) => {
        const { pinned: _previous, ...data } = current;
        void _previous;
        return pin ? { ...data, pinned: pin } : data;
      }),
    [updateNodeData],
  );

  const setNodeTestInputs = useCallback(
    (nodeId: string, scenarios: TriggerTestInput[]) => updateNodeData(nodeId, (data) => withNodeTestInputs(data, scenarios)),
    [updateNodeData],
  );

  const scenariosByNode = useStableValue(
    useMemo(() => testInputsByNode(structureNodes), [structureNodes]),
    sameTestInputsByNode,
  );
  const scenariosOf = useCallback((nodeId: string) => scenariosByNode.get(nodeId), [scenariosByNode]);

  const pinSimStep = useCallback(
    (step: SimStep) => {
      const labels = pinEdgeOptions(
        latestEdgesRef.current.map((edge) => ({ source: edge.source, label: getDomainEdgeLabel(edge) })),
        step.nodeId,
      );
      const pin = pinFromStep(step, labels, new Date());
      if (!pin) return;
      setNodePin(step.nodeId, pin);
      toast.success(tDebug("step.pinSaved"));
    },
    [setNodePin, tDebug, latestEdgesRef],
  );

  const toggleNodeBreakpoint = useCallback((nodeId: string) => setBreakpoints((prev) => toggleBreakpoint(prev, nodeId)), []);

  const { connect: connectSimulation, reset: resetSimulation, runUntil: simulateUntil, start: startSimulation, status: simStatus } = simulation;

  const openTestPanel = useCallback(() => {
    setTestOpen(true);
    setRightPreferred("test");
    if (!isLiveSimStatus(simStatus)) connectSimulation();
  }, [connectSimulation, simStatus, setTestOpen, setRightPreferred]);

  const closeTestPanel = useCallback(() => {
    resetSimulation();
    setTestOpen(false);
  }, [resetSimulation, setTestOpen]);

  const runUntilNode = useCallback(
    (nodeId: string) => {
      setTestOpen(true);
      setRightPreferred("test");
      setConfigNodeId(null);
      simulateUntil(nodeId);
    },
    [simulateUntil, setTestOpen, setRightPreferred, setConfigNodeId],
  );

  const reproduceRun = useCallback(
    (runId: string) => {
      setTestOpen(true);
      setRightPreferred("test");
      startSimulation({ reproduceRunId: runId });
    },
    [startSimulation, setTestOpen, setRightPreferred],
  );

  const nodeDebugControls = useMemo<NodeDebugControls>(
    () => ({
      breakpoints: liveBreakpointSet,
      unsaved: isWorkflowDirty,
      onToggleBreakpoint: toggleNodeBreakpoint,
      onRunUntil: runUntilNode,
      onPinChange: setNodePin,
      onShowTestPath: showNodeTestPath,
    }),
    [liveBreakpointSet, isWorkflowDirty, toggleNodeBreakpoint, runUntilNode, setNodePin, showNodeTestPath],
  );

  return {
    liveBreakpointSet,
    pinSimStep,
    toggleNodeBreakpoint,
    openTestPanel,
    closeTestPanel,
    runUntilNode,
    reproduceRun,
    nodeDebugControls,
    scenariosOf,
    setNodeTestInputs,
  };
}
