"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import {
  useNodesState,
  useEdgesState,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type {
  Workflow,
  WorkflowGraph,
  WorkflowType,
  WorkflowNodeType,
  NodeDefinition,
  HandleDefinition,
  RunDetail,
  WorkflowRunLog,
} from "@/lib/workflows/types";
import { isDebuggableBehavior, testBehaviorOf } from "@/lib/workflows/node-test-behavior";
import type { RightPanel } from "@/lib/workflows/editor-docking";
import type { RuntimeAlertFix } from "@/lib/workflows/runtime-alerts";
import { entryPointsByNode, type EntryPointFix } from "@/lib/workflows/entry-points";
import { initialDraftName } from "@/lib/workflows/draft-save";
import { mergeLintIssues, runDiffersFromCanvas } from "@/lib/workflows/publication";
import { getWorkflowVersionAction } from "@/app/actions/workflows";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { useStableCallback } from "@/hooks/use-stable-callback";
import { useWorkflowSimulation } from "@/hooks/use-workflow-simulation";
import {
  WORKFLOW_TYPES,
  definitionAllowedForType,
  workflowTypeOfTrigger,
} from "@/lib/workflows/workflow-types";
import { nextShortNodeId } from "@/lib/workflows/node-ids";
import { createDoubleTap, isMouseClick } from "@/lib/workflows/double-tap";
import { configFieldLabel } from "@/lib/workflows/lint-copy";

import type { WorkflowNodeData } from "./workflow-node";
import { createWorkflowSnapshot, flowToDomain } from "./workflow-graph";
import {
  graphBounds,
  holdDuringGesture,
  sameEdgeStructure,
  sameNodeGeometry,
  sameNodeLayout,
  sameNodeStructure,
} from "./graph-stability";
import { useStableValue } from "./use-stable-value";
import { buildObstacleIndex } from "./edge-routing";
import { createHoverStore } from "./edge-activity";
import { createRunOverlayStore } from "./run-overlay";
import { createNodeDebugStore } from "./node-debug-marks";
import type { VersionFocus } from "./version-run-canvas";
import { OpenRunContext } from "./run-bits";
import type { TestNodeSeed } from "./test-node-section";
import { NodeDefinitionsProvider } from "./node-previews/node-definitions";
import { NodeConfigPanel } from "./node-config-panel";
import { useUndoRedo } from "./use-undo-redo";
import { useWorkflowLint } from "./use-workflow-lint";
import {
  domainToFlow,
  isNodeTypeAllowedForType,
  type OutputLabels,
} from "./editor-flow";
import { EditorCanvas, type NodeMenuState, type VersionView } from "./editor-canvas";
import { EditorHeader } from "./editor-header";
import { EditorSidePanel } from "./editor-side-panel";
import { EditorRightSlot } from "./editor-right-slot";
import { useCanvasGestures } from "./use-canvas-gestures";
import { useCanvasRunOverlay } from "./use-canvas-run-overlay";
import { useCopilotGraph } from "./use-copilot-graph";
import { useEditorDebug } from "./use-editor-debug";
import { useEditorShortcuts } from "./use-editor-shortcuts";
import { useNodeHandles } from "./use-node-handles";
import { useNodeEditing } from "./use-node-editing";
import { useNodeSearch } from "./use-node-search";
import { useRuntimeAlerts } from "./use-runtime-alerts";
import { useWorkflowPersistence } from "./use-workflow-persistence";
import { DraftConflictDialog } from "./draft-conflict-dialog";
import { EntryPointsContext } from "./trigger-entry-mark";

interface WorkflowEditorProps {
  workflow?: Workflow | null;
  definitions: NodeDefinition[];
  mode: "create" | "edit";
  initialHandles?: Record<string, HandleDefinition[]>;
  onWorkflowUpdate?: (workflow: Workflow) => void;
  initialRunId?: string | null;
  initialAlertId?: string | null;
  initialNodeId?: string | null;
}

const WEBHOOK_TRIGGER_NODE_TYPE = "trigger_webhook";

const settledLayout = holdDuringGesture(sameNodeLayout);
const settledGeometry = holdDuringGesture(sameNodeGeometry);

export function WorkflowEditor({
  workflow,
  definitions,
  initialHandles,
  onWorkflowUpdate,
  initialRunId = null,
  initialAlertId = null,
  initialNodeId = null,
}: WorkflowEditorProps) {
  const t = useTranslations("workflowsPage");
  const tDebug = useTranslations("workflowDebug");
  const router = useRouter();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(() => initialDraftName(workflow, t("defaultName")));
  const [description, setDescription] = useState(workflow?.description ?? "");
  const [workflowType, setWorkflowType] = useState<WorkflowType>(() => {
    if (workflow?.type) return workflow.type;
    if (workflow?.triggerType)
      return workflowTypeOfTrigger(workflow.triggerType);
    return "messages";
  });
  const [workflowState, setWorkflowState] = useState<Workflow | null>(
    workflow ?? null,
  );
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionsReload, setVersionsReload] = useState(0);
  const canWriteSecrets = useSettledPermission("workflows", "update");
  const canCreate = useSettledPermission("workflows", "create");
  const canSave = workflowState?.id ? canWriteSecrets : canCreate;
  const [configNodeId, setConfigNodeId] = useState<string | null>(() =>
    initialNodeId && workflow?.graph?.nodes?.some((node) => node.id === initialNodeId) ? initialNodeId : null,
  );
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [runsOpen, setRunsOpen] = useState(Boolean(initialRunId));
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialRunId);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [testSeed, setTestSeed] = useState<{ nodeId: string; seed: TestNodeSeed } | null>(null);
  const [deliveriesFocusNode, setDeliveriesFocusNode] = useState<string | null>(null);
  const [runOverlayStore] = useState(createRunOverlayStore);
  const [debugStore] = useState(createNodeDebugStore);
  const [showCopilot, setShowCopilot] = useState(false);
  const [copilotMounted, setCopilotMounted] = useState(false);
  const [copilotBusy, setCopilotBusy] = useState(false);
  const [rightPreferred, setRightPreferred] = useState<RightPanel>("test");
  const [nodeTestPath, setNodeTestPath] = useState<WorkflowRunLog[] | null>(null);
  const [versionView, setVersionView] = useState<VersionView | null>(null);
  const [versionFocus, setVersionFocus] = useState<VersionFocus | null>(null);
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState | null>(null);
  const simulation = useWorkflowSimulation({
    workflowId: workflowState?.id ?? "",
  });
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const freshNodeId = useCallback(
    () => nextShortNodeId((reactFlowInstance.current?.getNodes() ?? []).map((node) => node.id)),
    [],
  );

  const mousePosRef = useRef({ x: 0, y: 0 });

  const defMap = useMemo(
    () => new Map(definitions.map((d) => [d.type, d])),
    [definitions],
  );

  const outputLabels: OutputLabels = useMemo(
    () => ({
      defaultPath: t("nodeOutputs.defaultPath"),
      textResponse: t("nodeOutputs.textResponse"),
      noMatch: t("nodeOutputs.noMatch"),
      error: t("nodeOutputs.error"),
      form: {
        completed: t("nodeOutputs.formCompleted"),
        no_reply: t("nodeOutputs.formNoReply"),
        send_failed: t("nodeOutputs.formSendFailed"),
      },
    }),
    [t],
  );

  const availableDefinitions = useMemo(
    () =>
      definitions.filter((def) =>
        definitionAllowedForType(workflowType, def),
      ),
    [definitions, workflowType],
  );

  const canAddNodeType = useCallback(
    (nodeType: WorkflowNodeType) =>
      isNodeTypeAllowedForType(workflowType, nodeType, defMap),
    [defMap, workflowType],
  );

  const workflowTypeOptions = useMemo(
    () =>
      WORKFLOW_TYPES.map((value) => ({
        value,
        label: t(`workflowTypeOption.${value}`),
      })),
    [t],
  );

  const triggerLabelByType = useMemo(() => {
    const map = new Map<string, string>();
    definitions
      .filter((d) => d.category === "trigger")
      .forEach((d) => map.set(d.type, d.label));
    return map;
  }, [definitions]);

  const [initial] = useState(() => domainToFlow(workflow?.graph, defMap, outputLabels, initialHandles));
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);

  const structureNodes = useStableValue(nodes, sameNodeStructure);
  const layoutNodes = useStableValue(nodes, settledLayout);
  const geometryNodes = useStableValue(nodes, settledGeometry);
  const canvasBounds = useMemo(() => graphBounds(geometryNodes), [geometryNodes]);
  const obstacleIndex = useMemo(() => buildObstacleIndex(geometryNodes), [geometryNodes]);
  const [hoverStore] = useState(createHoverStore);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  const edgeStructure = useStableValue(edges, sameEdgeStructure);
  const shownRun = runsOpen && runDetail && runDetail.run.id === selectedRunId ? runDetail : null;
  const canvasEdges = useCanvasRunOverlay({
    shownRun,
    testOpen: showTestPanel,
    simulationSteps: simulation.steps,
    simulationTriggerType: simulation.triggerType,
    nodeTestPath,
    structureNodes,
    edgeStructure,
    edges,
    store: runOverlayStore,
  });

  const { takeSnapshot, undo, redo, syncCurrent } = useUndoRedo(
    setNodes,
    setEdges,
  );

  useEffect(() => {
    syncCurrent(nodes, edges);
  }, [nodes, edges, syncCurrent]);

  const latestNodesRef = useRef(nodes);
  const latestEdgesRef = useRef(edges);
  useEffect(() => {
    latestNodesRef.current = nodes;
    latestEdgesRef.current = edges;
  }, [nodes, edges]);

  const resolvedHandles = useNodeHandles({
    definitions,
    defMap,
    structureNodes,
    latestNodesRef,
    setNodes,
    outputLabels,
    initialHandles,
  });

  const { applyCopilotGraph, tidyUpGraph, getCopilotGraph } = useCopilotGraph({
    showCopilot,
    takeSnapshot,
    defMap,
    outputLabels,
    resolvedHandles,
    setNodes,
    setEdges,
    latestNodesRef,
    latestEdgesRef,
  });

  const domainGraph = useMemo(() => flowToDomain(layoutNodes, edges), [layoutNodes, edges]);
  const lint = useWorkflowLint({ workflowType, graph: domainGraph });

  const nodeLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of structureNodes) {
      const data = n.data as unknown as WorkflowNodeData;
      map.set(n.id, (data?.label as string) || n.id);
    }
    return map;
  }, [structureNodes]);

  const nodeConfigById = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const n of structureNodes) {
      const data = n.data as unknown as WorkflowNodeData;
      if (data?.config) map.set(n.id, data.config);
    }
    return map;
  }, [structureNodes]);

  const centreOnNode = useCallback((nodeId: string) => {
    const node = latestNodesRef.current.find((n) => n.id === nodeId);
    if (!node) return false;
    const inst = reactFlowInstance.current;
    if (!inst) return true;
    const measured = node.measured as
      | { width?: number; height?: number }
      | undefined;
    inst.setCenter(
      node.position.x + (measured?.width ?? 220) / 2,
      node.position.y + (measured?.height ?? 120) / 2,
      { zoom: Math.max(inst.getZoom(), 0.9), duration: 450 },
    );
    return true;
  }, []);

  const selectOnly = useCallback(
    (nodeId: string | null) =>
      setNodes((nds) => {
        let changed = false;
        const next = nds.map((n) => {
          if (Boolean(n.selected) === (n.id === nodeId)) return n;
          changed = true;
          return { ...n, selected: n.id === nodeId };
        });
        return changed ? next : nds;
      }),
    [setNodes],
  );

  const runStepNodeRef = useRef<string | null>(null);

  const revealNode = useCallback(
    (nodeId: string) => {
      if (!centreOnNode(nodeId)) return false;
      selectOnly(nodeId);
      return true;
    },
    [centreOnNode, selectOnly],
  );

  const showRunStep = useCallback(
    (nodeId: string) => {
      if (versionView) {
        setVersionFocus((prev) => ({ nodeId, seq: (prev?.seq ?? 0) + 1 }));
        return;
      }
      if (revealNode(nodeId)) runStepNodeRef.current = nodeId;
    },
    [revealNode, versionView],
  );

  const releaseRunStep = useCallback(() => {
    const nodeId = runStepNodeRef.current;
    runStepNodeRef.current = null;
    if (nodeId && latestNodesRef.current.find((n) => n.id === nodeId)?.selected) selectOnly(null);
  }, [selectOnly]);

  const openNodeConfig = useCallback(
    (nodeId: string) => {
      if (centreOnNode(nodeId)) setConfigNodeId(nodeId);
    },
    [centreOnNode],
  );

  const openRun = useCallback((runId: string) => {
    setVersionsOpen(false);
    setRunsOpen(true);
    setSelectedRunId(runId);
  }, []);

  const openRunsPanel = useCallback(() => {
    setVersionsOpen(false);
    setRunsOpen(true);
  }, []);

  const closeRuns = useCallback(() => {
    setRunsOpen(false);
    setSelectedRunId(null);
    setRunDetail(null);
    setVersionView(null);
    releaseRunStep();
  }, [releaseRunStep]);

  const openVersionsPanel = useCallback(() => {
    closeRuns();
    setVersionsOpen(true);
  }, [closeRuns]);

  const selectRun = useCallback(
    (runId: string | null) => {
      setSelectedRunId(runId);
      releaseRunStep();
    },
    [releaseRunStep],
  );

  const testStepWithData = useCallback(
    (nodeId: string, seed: TestNodeSeed) => {
      setTestSeed({ nodeId, seed });
      openNodeConfig(nodeId);
    },
    [openNodeConfig],
  );

  const runNodeLabel = useCallback((nodeId: string) => nodeLabelById.get(nodeId), [nodeLabelById]);
  const runNodeExists = useCallback((nodeId: string) => nodeLabelById.has(nodeId), [nodeLabelById]);
  const runTriggerLabel = useCallback((triggerType: string) => triggerLabelByType.get(triggerType), [triggerLabelByType]);
  const nodeConfig = useCallback((nodeId: string) => nodeConfigById.get(nodeId), [nodeConfigById]);
  const nodeFieldLabel = useCallback(
    (nodeId: string, field: string) => {
      const node = structureNodes.find((n) => n.id === nodeId);
      const nodeType = (node?.data as unknown as WorkflowNodeData | undefined)?.nodeType;
      return configFieldLabel(nodeType ? defMap.get(nodeType) : undefined, field);
    },
    [structureNodes, defMap],
  );
  const nodeOutputLabel = useCallback(
    (nodeId: string, output: string) => {
      const node = structureNodes.find((n) => n.id === nodeId);
      return (node?.data as unknown as WorkflowNodeData | undefined)?.outputs?.find((handle) => handle.id === output)?.label || undefined;
    },
    [structureNodes],
  );
  const lintSubjects = useMemo(
    () => ({ nodeLabel: runNodeLabel, fieldLabel: nodeFieldLabel, outputLabel: nodeOutputLabel }),
    [runNodeLabel, nodeFieldLabel, nodeOutputLabel],
  );

  if (testSeed && testSeed.nodeId !== configNodeId) {
    setTestSeed(null);
  }
  if (versionView && versionView.runId !== selectedRunId) {
    setVersionView(null);
  }
  if (deliveriesFocusNode && deliveriesFocusNode !== configNodeId) {
    setDeliveriesFocusNode(null);
  }

  const savedWorkflowId = workflowState?.id ?? null;
  const runtimeAlerts = useRuntimeAlerts(savedWorkflowId);

  const webhookTriggerNodeId = useMemo(
    () =>
      structureNodes.find((n) => (n.data as unknown as WorkflowNodeData)?.nodeType === WEBHOOK_TRIGGER_NODE_TYPE)?.id ?? null,
    [structureNodes],
  );

  const { search, searchInputRef } = useNodeSearch({ structureNodes, defMap, setNodes, focusNode: revealNode });

  const applyCopilotMeta = useCallback(
    (meta: {
      name?: string;
      description?: string;
      workflowType?: WorkflowType;
    }) => {
      if (meta.name) setName(meta.name);
      if (meta.description) setDescription(meta.description);
      if (meta.workflowType) setWorkflowType(meta.workflowType);
    },
    [],
  );

  const editing = useNodeEditing({
    defMap,
    outputLabels,
    canAddNodeType,
    takeSnapshot,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    freshNodeId,
    reactFlowInstance,
    latestNodesRef,
    setConfigNodeId,
  });
  const { setCtxMenu } = editing;

  const configNode = useMemo(
    () =>
      configNodeId
        ? (structureNodes.find((n) => n.id === configNodeId) ?? null)
        : null,
    [structureNodes, configNodeId],
  );
  if (configNodeId && !configNode) {
    setConfigNodeId(null);
  }

  const currentSnapshot = useMemo(
    () =>
      createWorkflowSnapshot({
        name,
        description,
        workflowType,
        graph: domainGraph,
      }),
    [name, description, workflowType, domainGraph],
  );

  const persistence = useWorkflowPersistence({
    name,
    description,
    workflowType,
    graph: domainGraph,
    draftKey: currentSnapshot,
    canSave,
    workflowState,
    setWorkflowState,
    onWorkflowUpdate,
    defMap,
    triggerLabelByType,
    takeSnapshot,
    outputLabels,
    resolvedHandles,
    setNodes,
    setEdges,
    setName,
    setDescription,
    setWorkflowType,
    setConfigNodeId,
    onPublished: () => {
      setVersionsReload((n) => n + 1);
      runtimeAlerts.reload();
    },
    lintSubjects,
  });

  const lintIssues = useMemo(
    () => mergeLintIssues(lint.issues, persistence.publishIssues),
    [lint.issues, persistence.publishIssues],
  );

  const isWorkflowDirty = persistence.unsaved;

  const entryPointsByNodeId = useMemo(() => entryPointsByNode(workflowState?.entryPoints), [workflowState?.entryPoints]);

  const [nodeDoubleTap] = useState(createDoubleTap);
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (isMouseClick(event.nativeEvent)) return;
      if (nodeDoubleTap(node.id, event.timeStamp)) setConfigNodeId(node.id);
    },
    [nodeDoubleTap],
  );

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => setConfigNodeId(node.id), []);

  const savedId = workflowState?.id ?? null;
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const nodeType = (node.data as unknown as WorkflowNodeData)?.nodeType;
      event.preventDefault();
      setCtxMenu(null);
      setNodeMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        debuggable: Boolean(savedId && nodeType && isDebuggableBehavior(testBehaviorOf(defMap, nodeType))),
      });
    },
    [savedId, defMap, setCtxMenu],
  );

  const gestures = useCanvasGestures({ wrapperRef: reactFlowWrapper, hoverStore });

  const onFlowInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  const closeConfigPanel = useCallback(() => {
    const element = Array.from(reactFlowWrapper.current?.querySelectorAll<HTMLElement>(".react-flow__node") ?? []).find(
      (candidate) => candidate.dataset.id === configNodeId,
    );
    element?.focus({ preventScroll: true });
    setConfigNodeId(null);
  }, [configNodeId]);

  const onPaneClick = useCallback(() => {
    setCtxMenu(null);
    setNodeMenu(null);
  }, [setCtxMenu]);

  const showNodeTestPath = useCallback((steps: WorkflowRunLog[]) => setNodeTestPath(steps), []);

  const debug = useEditorDebug({
    simulation,
    testOpen: showTestPanel,
    setTestOpen: setShowTestPanel,
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
  });

  const viewRunVersion = useCallback(
    async (runId: string, version: number) => {
      if (!savedId) return;
      const res = await getWorkflowVersionAction(savedId, version);
      if (!res.version?.graph) {
        toast.error(tDebug("versionView.loadError", { version: `v${version}` }));
        return;
      }
      setVersionFocus(null);
      setVersionView({ runId, version, graph: res.version.graph, handles: res.version.handles ?? {} });
    },
    [savedId, tDebug],
  );

  const closeNodeMenu = useCallback(() => setNodeMenu(null), []);

  const versionHandles = versionView?.handles;
  const versionToFlow = useCallback(
    (graph: WorkflowGraph) => domainToFlow(graph, defMap, outputLabels, versionHandles),
    [defMap, outputLabels, versionHandles],
  );

  const openCopilot = useCallback(() => {
    setCopilotMounted(true);
    setShowCopilot(true);
    setRightPreferred("copilot");
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEditorShortcuts({
    configOpen: configNode !== null,
    openConfig: setConfigNodeId,
    defMap,
    setNodes,
    setEdges,
    undo,
    redo,
    takeSnapshot,
    canAddNodeType,
    outputLabels,
    searchOpen: search.searchOpen,
    openSearch: search.openSearch,
    closeSearch: search.closeSearch,
    latestNodesRef,
    latestEdgesRef,
    reactFlowInstance,
    mousePosRef,
    saveNow: persistence.saveNow,
  });

  const runVersionDiffers = useCallback(
    (runVersion: number | undefined) =>
      runDiffersFromCanvas(runVersion, workflowState ?? {}, isWorkflowDirty),
    [workflowState, isWorkflowDirty],
  );

  const fixRuntimeAlert = useStableCallback((fix: RuntimeAlertFix) => {
    switch (fix.kind) {
      case "publish":
        void persistence.handlePublish();
        return;
      case "open_run":
        openRun(fix.runId);
        return;
      case "open_node":
        openNodeConfig(fix.nodeId);
        return;
      case "view_deliveries":
        if (!webhookTriggerNodeId) return;
        setDeliveriesFocusNode(webhookTriggerNodeId);
        openNodeConfig(webhookTriggerNodeId);
        return;
    }
  });

  const fixEntryPoint = useStableCallback((fix: EntryPointFix) => {
    switch (fix.kind) {
      case "publish":
        void persistence.handlePublish();
        return;
      case "resume":
        void persistence.handleResume();
        return;
      case "open_node":
        openNodeConfig(fix.nodeId);
        return;
      case "link":
        router.push(fix.href);
        return;
    }
  });

  const changeWorkflowType = useStableCallback((nextType: WorkflowType) => {
    if (nextType === workflowType) return;
    if (showTestPanel) debug.closeTestPanel();
    setWorkflowType(nextType);
  });

  const toggleTestPanel = useStableCallback(() => (showTestPanel ? debug.closeTestPanel() : debug.openTestPanel()));

  const toggleRunsPanel = useStableCallback(() => (runsOpen ? closeRuns() : openRunsPanel()));

  const viewSimulationVersion = useStableCallback((version: number) => {
    const runId = simulation.reproducing?.runId;
    if (!runId) return;
    openRun(runId);
    void viewRunVersion(runId, version);
  });

  const pinBlockedReason = isWorkflowDirty ? tDebug("step.pinNeedsSave") : null;
  const runDebug = useMemo(
    () => ({
      pinStep: canWriteSecrets ? persistence.pinRunStep : undefined,
      pinBlockedReason,
      reproduce: canWriteSecrets && workflowType !== "voice" ? debug.reproduceRun : undefined,
      viewVersion: selectedRunId ? (version: number) => void viewRunVersion(selectedRunId, version) : undefined,
    }),
    [canWriteSecrets, persistence.pinRunStep, pinBlockedReason, workflowType, debug.reproduceRun, selectedRunId, viewRunVersion],
  );

  const closeVersions = useCallback(() => setVersionsOpen(false), []);
  const closeCopilot = useCallback(() => setShowCopilot(false), []);
  const clearNodeTestPath = useCallback(() => setNodeTestPath(null), []);
  const closeVersionView = useCallback(() => setVersionView(null), []);

  return (
    <NodeDefinitionsProvider definitions={definitions}>
    <OpenRunContext.Provider value={openRun}>
    <div className="flex flex-col h-[calc(100vh_-_var(--dashboard-header-h))] overflow-hidden">
      <EditorHeader
        name={name}
        onNameChange={setName}
        description={description}
        onDescriptionChange={setDescription}
        workflowType={workflowType}
        workflowTypeOptions={workflowTypeOptions}
        onWorkflowTypeChange={changeWorkflowType}
        workflowState={workflowState}
        testOpen={showTestPanel}
        onToggleTest={toggleTestPanel}
        runsOpen={runsOpen}
        onToggleRuns={toggleRunsPanel}
        lintValid={lint.valid && persistence.publishIssues.length === 0}
        lintIssues={lintIssues}
        linting={lint.linting}
        runtimeAlerts={runtimeAlerts.alerts}
        runtimeAlertsFailed={runtimeAlerts.failed}
        initialAlertId={initialAlertId}
        nodeLabel={runNodeLabel}
        fieldLabel={nodeFieldLabel}
        outputLabel={nodeOutputLabel}
        nodeConfig={nodeConfig}
        onFocusNode={openNodeConfig}
        onRuntimeFix={fixRuntimeAlert}
        onAlertsOpen={savedWorkflowId ? runtimeAlerts.reload : undefined}
        alertsRequest={persistence.alertsRequest}
        onConfigChange={editing.onConfigChange}
        saveStatus={persistence.saveStatus}
        unsaved={persistence.unsaved}
        onRetrySave={persistence.retrySave}
        onResolveConflict={persistence.showConflict}
        onEntryFix={fixEntryPoint}
        publishing={persistence.publishing}
        onPublish={persistence.handlePublish}
        onPause={persistence.handlePause}
        onResume={persistence.handleResume}
        onOpenVersions={openVersionsPanel}
        onDelete={persistence.handleDelete}
      />

      <div className="flex flex-1 overflow-hidden">
        <EditorSidePanel
          workflowId={workflowState?.id ?? null}
          publication={workflowState}
          runsOpen={runsOpen}
          selectedRunId={selectedRunId}
          onSelectRun={selectRun}
          onRunDetail={setRunDetail}
          triggerLabel={runTriggerLabel}
          nodeLabel={runNodeLabel}
          nodeExists={runNodeExists}
          onFocusNode={showRunStep}
          onTestStep={testStepWithData}
          runDiffersFromCanvas={runVersionDiffers}
          runDebug={runDebug}
          onCloseRuns={closeRuns}
          versionsOpen={versionsOpen}
          versionsReload={versionsReload}
          hasLocalEdits={isWorkflowDirty}
          onRestoreVersion={persistence.handleRestoreVersion}
          onCloseVersions={closeVersions}
          definitions={availableDefinitions}
        />

        <EntryPointsContext.Provider value={entryPointsByNodeId}>
        <EditorCanvas
          wrapperRef={reactFlowWrapper}
          onDragOver={editing.onDragOver}
          onDrop={editing.onDrop}
          onMouseMove={onMouseMove}
          obstacleIndex={obstacleIndex}
          hoverStore={hoverStore}
          runOverlayStore={runOverlayStore}
          debugStore={debugStore}
          versionView={versionView}
          versionToFlow={versionToFlow}
          shownRun={shownRun}
          versionFocus={versionFocus}
          onVersionBack={closeVersionView}
          nodes={nodes}
          edges={canvasEdges}
          onNodesChange={editing.wrappedOnNodesChange}
          onEdgesChange={editing.wrappedOnEdgesChange}
          onConnect={editing.onConnect}
          onReconnect={editing.onReconnect}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeContextMenu={onNodeContextMenu}
          onNodeMouseEnter={gestures.onNodeMouseEnter}
          onNodeMouseLeave={gestures.onNodeMouseLeave}
          onPaneClick={onPaneClick}
          onPaneContextMenu={editing.onPaneContextMenu}
          onInit={onFlowInit}
          onMoveStart={gestures.onMoveStart}
          onMoveEnd={gestures.onMoveEnd}
          onNodeDragStart={gestures.onNodeDragStart}
          onNodeDragStop={gestures.onNodeDragStop}
          canvasBounds={canvasBounds}
          onTidyUp={tidyUpGraph}
          onUndo={undo}
          onRedo={redo}
          onDeleteSelected={editing.deleteSelected}
          search={search}
          searchInputRef={searchInputRef}
          showNodeTestPath={Boolean(nodeTestPath) && !shownRun && !(showTestPanel && simulation.steps.length > 0)}
          onClearNodeTestPath={clearNodeTestPath}
          nodeMenu={nodeMenu}
          nodeMenuBreakpoint={nodeMenu ? debug.liveBreakpointSet.has(nodeMenu.nodeId) : false}
          onConfigureNode={setConfigNodeId}
          onRunUntil={debug.runUntilNode}
          onToggleBreakpoint={debug.toggleNodeBreakpoint}
          onCloseNodeMenu={closeNodeMenu}
          paneMenu={editing.ctxMenu}
          paneMenuDefinitions={availableDefinitions}
          onPaneMenuSelect={editing.onCtxMenuSelect}
          onClosePaneMenu={editing.closePaneMenu}
        />
        </EntryPointsContext.Provider>

        <EditorRightSlot
          testOpen={showTestPanel && Boolean(workflowState)}
          copilotOpen={showCopilot}
          copilotMounted={copilotMounted}
          copilotBusy={copilotBusy}
          preferred={rightPreferred}
          onPrefer={setRightPreferred}
          onOpenCopilot={openCopilot}
          onCloseCopilot={closeCopilot}
          simulation={simulation}
          voice={workflowType === "voice"}
          onCloseTest={debug.closeTestPanel}
          unsaved={isWorkflowDirty}
          nodeLabel={runNodeLabel}
          nodeExists={runNodeExists}
          onFocusNode={showRunStep}
          onPinStep={debug.pinSimStep}
          versionDiffers={runVersionDiffers}
          onViewVersion={viewSimulationVersion}
          workflowId={workflowState?.id ?? ""}
          workflowType={workflowType}
          onCopilotGraph={applyCopilotGraph}
          onCopilotMeta={applyCopilotMeta}
          getCopilotGraph={getCopilotGraph}
          onCopilotBusyChange={setCopilotBusy}
        />

        {configNode && (
          <NodeConfigPanel
            node={configNode}
            workflowId={workflowState?.id ?? null}
            workspaceId={workflowState?.workspaceId ?? null}
            isWorkflowDirty={isWorkflowDirty}
            definitions={definitions}
            allNodes={structureNodes}
            allEdges={edges}
            onClose={closeConfigPanel}
            onConfigChange={editing.onConfigChange}
            onRenameNode={editing.renameNode}
            testSeed={testSeed?.nodeId === configNode.id ? testSeed.seed : null}
            focusDeliveries={deliveriesFocusNode === configNode.id}
            debug={debug.nodeDebugControls}
          />
        )}
      </div>
      <DraftConflictDialog
        open={persistence.conflictOpen}
        canOverwrite={persistence.canOverwrite}
        onReload={persistence.reloadDraft}
        onOverwrite={persistence.overwriteDraft}
        onDismiss={persistence.dismissConflict}
      />
    </div>
    </OpenRunContext.Provider>
    </NodeDefinitionsProvider>
  );
}
