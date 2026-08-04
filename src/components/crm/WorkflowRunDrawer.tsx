"use client";

/**
 * WorkflowRunDrawer, a read-only view of the workflow attending a conversation, with
 * the current node highlighted. It reuses the real workflow node renderers
 * (WorkflowNode/GroupNode) and their built-in current-node ring (isSimulating), so it
 * looks exactly like the editor, but with all editing/interaction disabled.
 *
 * It builds the graph the same way the editor does: getWorkflowAction (the graph) +
 * getNodeTypesAction (labels/icons) + resolveHandlesAction (the backend is the source of
 * truth for each node's output handles, so edges attach to the right handles). The
 * current node + run status come from the conversation's ai_handler.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  Position,
  type Edge,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FlowArrow } from "@/components/icons";

import {
  getNodeTypesAction,
  getWorkflowAction,
  resolveHandlesAction,
} from "@/app/actions/workflows";
import {
  WorkflowNode,
  GroupNode,
  type WorkflowNodeData,
} from "@/app/[locale]/dashboard/workflows/_components/workflow-node";
import type {
  HandleDefinition,
  NodeDefinition,
  Workflow,
  WorkflowNodeType,
} from "@/lib/workflows/types";
import type { AIHandler } from "@/lib/conversations/types";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { cn } from "@/lib/utils";

interface WorkflowRunDrawerProps {
  handler: AIHandler | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RUN_STATUS_META: Record<string, { label: string; className: string }> = {
  running: { label: "Em execução", className: "bg-muted text-lamp-ink" },
  waiting: {
    label: "Aguardando",
    className: "bg-warning/10 text-warning dark:text-amber-400",
  },
  completed: {
    label: "Concluído",
    className: "bg-healthy/10 text-healthy dark:text-healthy",
  },
  error: {
    label: "Erro",
    className: "bg-destructive/10 text-destructive dark:text-red-400",
  },
  cancelled: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
};

const CATEGORY_COLOR: Record<string, string> = {
  trigger_: "#10b981",
  wait_: "#f59e0b",
  condition_: "#a855f7",
  end: "#f43f5e",
};

function miniMapColor(node: Node): string {
  const t = String((node.data as WorkflowNodeData)?.nodeType ?? "");
  if (t.startsWith("trigger_")) return CATEGORY_COLOR.trigger_;
  if (t.startsWith("wait_")) return CATEGORY_COLOR.wait_;
  if (t.startsWith("condition_")) return CATEGORY_COLOR.condition_;
  if (t === "end") return CATEGORY_COLOR.end;
  return "#2463eb";
}

export function WorkflowRunDrawer({
  handler,
  open,
  onOpenChange,
}: WorkflowRunDrawerProps) {
  const workflowId = handler?.workflow_id;
  const currentNodeId = handler?.current_node_id ?? null;

  const [state, setState] = useState<{
    loading: boolean;
    error?: string;
    workflow?: Workflow;
    defs?: NodeDefinition[];
    handles?: Record<string, HandleDefinition[]>;
  }>({ loading: false });

  useEffect(() => {
    if (!open || !workflowId) return;
    let cancelled = false;
    (async () => {
      setState({ loading: true });
      const [wf, dfs] = await Promise.all([
        getWorkflowAction(workflowId),
        getNodeTypesAction(),
      ]);
      if (cancelled) return;
      if (wf.error || !wf.workflow) {
        setState({ loading: false, error: wf.error ?? "Fluxo não encontrado" });
        return;
      }
      // Resolve the real output handles for each node (source of truth), so edges to
      // dynamic branches (AI agent, condition, interactive prompt) attach correctly.
      const wfNodes = wf.workflow.graph?.nodes ?? [];
      const { handles } = wfNodes.length
        ? await resolveHandlesAction(
            wfNodes.map((n) => ({ id: n.id, type: n.type, config: n.config ?? {} })),
          )
        : { handles: {} as Record<string, HandleDefinition[]> };
      if (cancelled) return;
      setState({
        loading: false,
        workflow: wf.workflow,
        defs: dfs.definitions ?? [],
        handles,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [open, workflowId]);

  const nodeTypes: NodeTypes = useMemo(
    () => ({ workflowNode: WorkflowNode, groupNode: GroupNode }),
    [],
  );

  const { nodes, edges } = useMemo(() => {
    const wf = state.workflow;
    if (!wf?.graph) return { nodes: [] as Node[], edges: [] as Edge[] };
    const defMap = new Map<string, NodeDefinition>(
      (state.defs ?? []).map((d) => [d.type, d]),
    );
    const handlesByNode = state.handles ?? {};
    const handleIdsByNode = new Map<string, string[]>();

    const rfNodes: Node[] = (wf.graph.nodes ?? []).map((n) => {
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
          draggable: false,
          selectable: false,
          connectable: false,
          data: {
            nodeType: "group" as WorkflowNodeType,
            config: cfg,
            label: (cfg.display_name as string) || "Grupo",
          } satisfies WorkflowNodeData,
        };
      }
      const def = defMap.get(n.type);
      const outputs = handlesByNode[n.id] ?? def?.outputs;
      handleIdsByNode.set(n.id, (outputs ?? []).map((o) => o.id));
      return {
        id: n.id,
        type: "workflowNode",
        position: n.position,
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
        draggable: false,
        selectable: false,
        connectable: false,
        data: {
          nodeType: n.type,
          config: n.config ?? {},
          label: (n.config?.display_name as string) || def?.label,
          icon: def?.icon,
          outputs,
          isSimulating: n.id === currentNodeId,
        } satisfies WorkflowNodeData,
      };
    });

    const rfEdges: Edge[] = (wf.graph.edges ?? []).map((e, i) => {
      const sourceIds = handleIdsByNode.get(e.source) ?? [];
      let sourceHandle: string | undefined = e.label || undefined;
      if (!sourceHandle && sourceIds.length > 0) {
        sourceHandle = sourceIds.includes("default")
          ? "default"
          : sourceIds.length === 1
            ? sourceIds[0]
            : undefined;
      }
      const onPath = e.target === currentNodeId || e.source === currentNodeId;
      return {
        id: `e-${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
        sourceHandle,
        label: e.label ?? undefined,
        animated: onPath,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: {
          strokeWidth: onPath ? 2 : 1.5,
          stroke: onPath ? "#2463eb" : "#94a3b8",
        },
      };
    });

    return { nodes: rfNodes, edges: rfEdges };
  }, [state.workflow, state.defs, state.handles, currentNodeId]);

  // Fit the view once the graph is ready AND the slide-in animation has settled, so
  // ReactFlow measures the final container size (fitting mid-animation misplaces nodes).
  const instanceRef = useRef<ReactFlowInstance | null>(null);
  useEffect(() => {
    if (state.loading || state.error || nodes.length === 0) return;
    // The sheet slide-in runs 500ms; fit after it settles so the graph fills the final
    // container size (fitting mid-animation leaves nodes tiny or off-screen).
    const id = window.setTimeout(() => {
      instanceRef.current?.fitView({ padding: 0.2, duration: 300 });
    }, 560);
    return () => window.clearTimeout(id);
  }, [state.loading, state.error, nodes.length]);

  const statusMeta =
    (handler?.run_status && RUN_STATUS_META[handler.run_status]) || null;
  const workflowName = state.workflow?.name || handler?.workflow_name || "Fluxo";
  const ready = !state.loading && !state.error && nodes.length > 0;

  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent
        side="right"
        className="flex w-[94vw] flex-col gap-0 p-0 sm:max-w-4xl"
      >
        <ElevatedSheetHeader className="shrink-0 space-y-0 border-b border-border px-6 py-4 text-left">
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
              <FlowArrow className="h-5 w-5 text-white" weight="fill" />
            </span>
            <div className="min-w-0">
              <ElevatedSheetTitle className="truncate text-base font-semibold text-foreground">
                {workflowName}
              </ElevatedSheetTitle>
              <ElevatedSheetDescription className="mt-0.5 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Fluxo em atendimento</span>
                {statusMeta && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-[--radius] px-2 py-0.5 text-[10px] font-medium",
                      statusMeta.className,
                    )}
                  >
                    {statusMeta.label}
                  </span>
                )}
              </ElevatedSheetDescription>
            </div>
          </div>
        </ElevatedSheetHeader>

        <div className="relative min-h-0 flex-1 bg-muted">
          <div className="absolute inset-0">
            {ready && (
              <ReactFlowProvider>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onInit={(inst) => {
                    instanceRef.current = inst;
                  }}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  minZoom={0.15}
                  maxZoom={1.5}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  panOnScroll
                  zoomOnScroll
                  proOptions={{ hideAttribution: true }}
                >
                  <Background
                    variant={BackgroundVariant.Dots}
                    gap={18}
                    size={1}
                    color="var(--border)"
                  />
                  <Controls
                    showInteractive={false}
                    position="bottom-left"
                    className="!shadow-sm"
                  />
                  <MiniMap
                    pannable
                    zoomable
                    nodeColor={miniMapColor}
                    nodeStrokeWidth={2}
                    maskColor="rgba(0,0,0,0.06)"
                    className="!bottom-3 !right-3 rounded-lg border border-border !bg-card"
                  />
                </ReactFlow>
              </ReactFlowProvider>
            )}
          </div>

          {state.loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-8 w-8 animate-spin rounded-full border border-muted border-t-primary"
                role="status"
                aria-label="Carregando fluxo"
              />
            </div>
          )}
          {state.error && !state.loading && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {state.error}
            </div>
          )}
          {!state.loading && !state.error && nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Este fluxo ainda não tem nós para exibir.
            </div>
          )}
        </div>

        {handler?.current_node_type && ready && (
          <div className="flex shrink-0 items-center gap-2 border-t border-border px-6 py-3 text-xs">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-muted-foreground">Nó atual:</span>
            <span className="truncate font-medium text-foreground">
              {handler.current_node_type}
            </span>
          </div>
        )}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
