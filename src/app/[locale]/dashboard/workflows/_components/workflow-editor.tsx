"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  type DragEvent,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
  BackgroundVariant,
  MarkerType,
  Panel,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FloppyDisk,
  Play,
  Pause,
  Trash,
  ArrowCounterClockwise,
  ArrowClockwise,
  TestTube,
  Upload,
  Sparkle,
  TreeStructure,
  DotsThreeVertical,
  MagnifyingGlass,
} from "@/components/icons";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { BrandLogo } from "@/components/brand-logo";
import { getApiBaseUrl } from "@/lib/api/browser-client";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import type {
  Workflow,
  WorkflowGraph,
  WorkflowNode as WFNode,
  WorkflowEdge as WFEdge,
  WorkflowTriggerType,
  WorkflowType,
  WorkflowNodeType,
  CreateWorkflowPayload,
  UpdateWorkflowPayload,
  NodeDefinition,
  HandleDefinition,
  WorkflowNodeScope,
} from "@/lib/workflows/types";
import {
  createWorkflowAction,
  updateWorkflowAction,
  activateWorkflowAction,
  pauseWorkflowAction,
  deleteWorkflowAction,
  getWorkflowAction,
  resolveHandlesAction,
} from "@/app/actions/workflows";

import {
  WorkflowNode,
  GroupNode,
  type WorkflowNodeData,
} from "./workflow-node";
import { getDomainEdgeLabel } from "./workflow-graph";
import { NodePalette } from "./node-palette";
import { NodeConfigPanel } from "./node-config-panel";
import { SmartBezierEdge, SmartConnectionLine } from "./smart-edge";
import { useUndoRedo } from "./use-undo-redo";
import { CanvasContextMenu } from "./canvas-context-menu";
import { WorkflowTestPanel } from "./workflow-test-panel";
import { WorkflowCopilotPanel } from "./workflow-copilot-panel";
import { layoutCopilotSubgraph, layoutWholeFlow } from "./copilot-layout";
import { WorkflowAlerts } from "./workflow-alerts";
import { useWorkflowLint } from "./use-workflow-lint";
import { WorkflowSearch } from "./workflow-search";
import { matchNodeIds } from "./workflow-node-search";
import { useWorkflowSimulation } from "@/hooks/use-workflow-simulation";

interface WorkflowEditorProps {
  workflow?: Workflow | null;
  definitions: NodeDefinition[];
  mode: "create" | "edit";
  // Backend-resolved output handles per node id, resolved server-side at load so
  // dynamic handles (and their edges) are present on first paint, no flash while
  // the client re-resolves. Keyed by node id.
  initialHandles?: Record<string, HandleDefinition[]>;
  onWorkflowUpdate?: (workflow: Workflow) => void;
}

function workflowTypeFromTrigger(_triggerType: WorkflowTriggerType): WorkflowType {
  return "messages";
}

function triggerWorkflowTypeFromDef(
  def?: Pick<NodeDefinition, "category" | "scopes">,
): WorkflowType | null {
  if (!def || def.category !== "trigger") {
    return null;
  }
  const scopes = getDefinitionScopes(def);
  if (scopes.includes("whatsapp") || scopes.includes("shared")) {
    return "messages";
  }
  return null;
}

function getDefinitionScopes(
  def?: Pick<NodeDefinition, "scopes">,
): WorkflowNodeScope[] {
  return def?.scopes ?? [];
}

function isDefinitionAllowedForType(
  wfType: WorkflowType,
  def?: Pick<NodeDefinition, "type" | "category" | "scopes">,
) {
  if (!def) {
    return false;
  }

  if (def.type === "group" || def.type === "decoration_background") {
    return true;
  }

  const scopes = getDefinitionScopes(def);
  if (scopes.includes("shared")) {
    return true;
  }

  return scopes.includes("whatsapp");
}

function isNodeTypeAllowedForType(
  wfType: WorkflowType,
  nodeType: WorkflowNodeType,
  defMap: Map<string, NodeDefinition>,
) {
  if (nodeType === "group" || nodeType === "decoration_background") {
    return true;
  }

  return isDefinitionAllowedForType(wfType, defMap.get(nodeType));
}

interface OutputLabels {
  defaultPath: string;
  textResponse: string;
  noMatch: string;
  error: string;
}

function resolveOutputLabel(
  nodeType: WorkflowNodeType,
  outputId: string,
  labels: OutputLabels,
  fallbackLabel?: string,
): string {
  const normalizedId = outputId.trim().toLowerCase();

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

function normalizeOutputs(
  nodeType: WorkflowNodeType,
  outputs: HandleDefinition[] | undefined,
  labels: OutputLabels,
): HandleDefinition[] | undefined {
  if (!outputs?.length) return outputs;

  return outputs.map((output) => ({
    ...output,
    label: resolveOutputLabel(nodeType, output.id, labels, output.label),
  }));
}

// NOTE: output handles (including config-dependent ones for ai_agent tool routes,
// the response path, and text_match cases) and their optional/required flags are
// owned by the backend and fetched via resolveHandlesAction. The frontend used to
// recompute them here, and hardcoded `optional: true` for the AI response, which
// diverged from the backend. That local computation is intentionally gone.

function checkMissingRequired(
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

  if (nodeType === "action_ai_agent") {
    const source = config.source as string;
    if (source === "prompt") {
      return !config.model || !config.instructions;
    }
    return !config.agent_id;
  }

  return false;
}

function domainToFlow(
  graph: WorkflowGraph | undefined,
  defMap: Map<string, NodeDefinition>,
  outputLabels: OutputLabels,
  // Backend-resolved handles per node id (server-resolved on load). When present
  // for a node, they're used so dynamic handles + their edges render on first
  // paint; otherwise we fall back to the static catalog handles.
  handlesByNode: Record<string, HandleDefinition[]> = {},
): { nodes: Node[]; edges: Edge[] } {
  if (!graph) return { nodes: [], edges: [] };
  // node id → its output handle ids, so edges can resolve an empty/legacy label
  // to a real handle (see the edge mapping below).
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
    // Prefer backend-resolved handles (so dynamic handles + edges show on first
    // paint); fall back to the static catalog handles. The frontend never
    // computes handles itself.
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
      } satisfies WorkflowNodeData,
    };
  });
  const edges: Edge[] = (graph.edges ?? []).map((e: WFEdge, i: number) => {
    // A React Flow edge only renders if its sourceHandle matches a handle on the
    // node. Older graphs (and edges saved before nodes had named handles) carry an
    // empty label → undefined sourceHandle, which no longer matches now that nodes
    // expose named handles (e.g. an AI agent's "default"/"erro"). Map an empty
    // label to the node's "default" handle (or its sole handle) so the connection
    // still draws. Resolving is purely visual; the saved label is unchanged.
    const sourceIds = handleIdsByNode.get(e.source) ?? [];
    let sourceHandle: string | undefined = e.label || undefined;
    if (!sourceHandle && sourceIds.length > 0) {
      sourceHandle = sourceIds.includes("default")
        ? "default"
        : sourceIds.length === 1
          ? sourceIds[0]
          : undefined;
    }
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

function flowToDomain(nodes: Node[], edges: Edge[]): WorkflowGraph {
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
      .map((node) => ({
        ...node,
        config: sanitizeWorkflowConfig(node.config ?? {}),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...(graph.edges ?? [])].sort((left, right) => {
      const leftKey = `${left.source}:${left.label ?? ""}:${left.target}`;
      const rightKey = `${right.source}:${right.label ?? ""}:${right.target}`;
      return leftKey.localeCompare(rightKey);
    }),
  };
}

function createWorkflowSnapshot(input: {
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

let nodeIdCounter = 0;
function nextNodeId() {
  nodeIdCounter++;
  return `node_${Date.now()}_${nodeIdCounter}`;
}

// Stable signature of the parts of a node the copilot can edit (config + label),
// used to detect "the AI changed this node" so we can flash it.
function copilotNodeSig(data: unknown): string {
  const d = (data ?? {}) as { config?: unknown; label?: unknown };
  return JSON.stringify({ c: d.config ?? null, l: d.label ?? null });
}

export function WorkflowEditor({
  workflow,
  definitions,
  initialHandles,
  onWorkflowUpdate,
}: WorkflowEditorProps) {
  const t = useTranslations("workflowsPage");
  const router = useRouter();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(workflow?.name ?? "");
  const [description, setDescription] = useState(workflow?.description ?? "");
  const [workflowType, setWorkflowType] = useState<WorkflowType>(() => {
    if (workflow?.type) return workflow.type;
    if (workflow?.triggerType)
      return workflowTypeFromTrigger(workflow.triggerType);
    return "messages";
  });
  const [workflowState, setWorkflowState] = useState<Workflow | null>(
    workflow ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTypeFilter, setSearchTypeFilter] = useState<string | null>(null);
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  // Mount the copilot panel once (on first open) and keep it mounted afterwards ,
  // toggling `showCopilot` only shows/hides it. This preserves the live WebSocket
  // session and the chat history across close/reopen instead of tearing them
  // down on unmount (the old `{showCopilot && …}` killed the session every close).
  const [copilotMounted, setCopilotMounted] = useState(false);
  const simulation = useWorkflowSimulation({
    workflowId: workflowState?.id ?? "",
  });
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const { resolvedTheme } = useTheme();
  const activeSimulation = simulation;

  const clipboardRef = useRef<{
    nodeType: WorkflowNodeType;
    label?: string;
    icon?: string;
  } | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });

  const defMap = useMemo(
    () => new Map(definitions.map((d) => [d.type, d])),
    [definitions],
  );

  // Which node types have config-dependent handles comes from the backend catalog
  // (def.dynamicHandles), NOT a hardcoded list, the backend is the source of truth.
  const dynamicTypes = useMemo(
    () =>
      new Set(definitions.filter((d) => d.dynamicHandles).map((d) => d.type)),
    [definitions],
  );

  const outputLabels: OutputLabels = useMemo(
    () => ({
      defaultPath: t("nodeOutputs.defaultPath"),
      textResponse: t("nodeOutputs.textResponse"),
      noMatch: t("nodeOutputs.noMatch"),
      error: t("nodeOutputs.error"),
    }),
    [t],
  );

  const availableDefinitions = useMemo(
    () =>
      definitions.filter((def) =>
        isDefinitionAllowedForType(workflowType, def),
      ),
    [definitions, workflowType],
  );

  const canAddNodeType = useCallback(
    (nodeType: WorkflowNodeType) =>
      isNodeTypeAllowedForType(workflowType, nodeType, defMap),
    [defMap, workflowType],
  );

  const workflowTypeOptions = useMemo(
    () => [
      {
        value: "messages" as WorkflowType,
        label: t("workflowTypeOption.messages"),
      },
    ],
    [t],
  );

  const triggerLabelByType = useMemo(() => {
    const map = new Map<string, string>();
    definitions
      .filter((d) => d.category === "trigger")
      .forEach((d) => map.set(d.type, d.label));
    return map;
  }, [definitions]);

  const initial = useMemo(
    () => domainToFlow(workflowState?.graph, defMap, outputLabels, initialHandles),
    [workflowState?.graph, defMap, outputLabels, initialHandles],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  // Backend-resolved output handles, keyed by node id. The backend is the single
  // source of truth for which handles a node has and whether each is optional ,
  // the render effect overlays these onto the canvas. Seeded with the server-
  // resolved handles so an existing workflow shows its handles + edges instantly.
  const [resolvedHandles, setResolvedHandles] = useState<
    Record<string, HandleDefinition[]>
  >(initialHandles ?? {});

  const { takeSnapshot, undo, redo, syncCurrent } = useUndoRedo(
    setNodes,
    setEdges,
  );

  useEffect(() => {
    syncCurrent(nodes, edges);
  }, [nodes, edges, syncCurrent]);

  // --- Copilot auto-layout plumbing ---------------------------------------
  // Keep the latest committed nodes/edges reachable from async callbacks (ELK is
  // async) without forcing those callbacks to be recreated every render.
  const latestNodesRef = useRef(nodes);
  const latestEdgesRef = useRef(edges);
  useEffect(() => {
    latestNodesRef.current = nodes;
    latestEdgesRef.current = edges;
  }, [nodes, edges]);

  // Nodes that existed when the copilot opened, these are "user-owned" and the
  // copilot auto-layout must never move them. Everything the copilot adds after
  // that is "touched" and gets arranged. Captured once per copilot session.
  const copilotBaselineRef = useRef<Set<string> | null>(null);
  // Guards against stale async layouts: a newer snapshot supersedes an older one.
  const applySeqRef = useRef(0);
  // Copilot reveal-animation bookkeeping: which node ids have already played their
  // entrance, the last config/label signature per node (to detect AI edits), and a
  // monotonic counter so each detected edit triggers a fresh flash.
  const appearedIdsRef = useRef<Set<string>>(new Set());
  const appearedEdgeIdsRef = useRef<Set<string>>(new Set());
  const nodeSigRef = useRef<Map<string, string>>(new Map());
  const flashCounterRef = useRef(0);
  useEffect(() => {
    if (showCopilot) {
      const cur = latestNodesRef.current;
      copilotBaselineRef.current = new Set(cur.map((n) => n.id));
      // Existing nodes are already "present": don't entrance-animate them, and
      // record their signatures so the first AI snapshot doesn't false-flash them.
      appearedIdsRef.current = new Set(cur.map((n) => n.id));
      appearedEdgeIdsRef.current = new Set(
        latestEdgesRef.current.map((e) => e.id),
      );
      nodeSigRef.current = new Map(
        cur.map((n) => [n.id, copilotNodeSig(n.data)]),
      );
    } else {
      copilotBaselineRef.current = null;
    }
  }, [showCopilot]);

  // Live-apply a graph streamed by the AI copilot onto the canvas. Snapshots
  // first so the user can undo the AI's changes. Untouched (user-owned) nodes
  // keep their current canvas positions; copilot-added nodes are auto-arranged
  // (ELK, left-to-right) and anchored next to the nodes they connect to.
  const applyCopilotGraph = useCallback(
    (graph: WorkflowGraph) => {
      takeSnapshot();
      // Pass the already-resolved handles so existing dynamic nodes keep their
      // tool-route/case edges while the copilot streams (new nodes fall back to
      // catalog handles and get their dynamic ones from the resolve effect).
      const flow = domainToFlow(graph, defMap, outputLabels, resolvedHandles);
      const baseline = copilotBaselineRef.current ?? new Set<string>();
      const currentPos = new Map(
        latestNodesRef.current.map((n) => [n.id, n.position]),
      );
      // Preserve user-owned nodes exactly where they sit on the canvas.
      const preserved = flow.nodes.map((n) =>
        baseline.has(n.id) && currentPos.has(n.id)
          ? { ...n, position: currentPos.get(n.id)! }
          : n,
      );
      const touchedIds = new Set(
        preserved.filter((n) => !baseline.has(n.id)).map((n) => n.id),
      );

      // Tag entrance order (new nodes, staggered left-to-right) and a flash nonce
      // (existing nodes whose config/label the AI just changed) so the canvas can
      // reveal additions sequentially and blink edits in Signal Blue.
      const tag = (list: typeof preserved) => {
        const fresh = list
          .filter((n) => !appearedIdsRef.current.has(n.id))
          .slice()
          .sort((a, b) => a.position.x - b.position.x);
        const order = new Map(fresh.map((n, i) => [n.id, i] as const));
        return list.map((n) => {
          const sig = copilotNodeSig(n.data);
          let appearSeqV: number | undefined;
          let flashAtV: number | undefined;
          if (order.has(n.id)) {
            appearSeqV = order.get(n.id);
            appearedIdsRef.current.add(n.id);
          } else if (nodeSigRef.current.get(n.id) !== sig) {
            flashAtV = ++flashCounterRef.current;
          }
          nodeSigRef.current.set(n.id, sig);
          return {
            ...n,
            data: { ...n.data, _appearSeq: appearSeqV, _flashAt: flashAtV },
          };
        });
      };

      // Tag new edges so the canvas draws connections in sequentially, the same
      // way nodes reveal. Edges are identical across the layout branches below.
      const tagEdges = (eds: typeof flow.edges) => {
        const fresh = eds.filter((e) => !appearedEdgeIdsRef.current.has(e.id));
        const order = new Map(fresh.map((e, i) => [e.id, i] as const));
        return eds.map((e) => {
          if (!order.has(e.id)) return e;
          appearedEdgeIdsRef.current.add(e.id);
          return {
            ...e,
            data: { ...(e.data ?? {}), _appearSeq: order.get(e.id) },
          };
        });
      };
      const taggedEdges = tagEdges(flow.edges);

      const seq = ++applySeqRef.current;
      if (touchedIds.size === 0) {
        setNodes(tag(preserved));
        setEdges(taggedEdges);
        return;
      }
      // Once the freshly-added nodes have rendered and MEASURED, re-flow ONLY that
      // touched cluster with their real heights, the first pass used estimated
      // heights (unmeasured nodes), so spacing can be a touch off. This never moves
      // existing/user-arranged nodes: layoutCopilotSubgraph only repositions the
      // touched set and re-anchors it to the (untouched) flow it grew from.
      const relayoutTouchedWhenMeasured = (touched: Set<string>, s: number) => {
        if (touched.size === 0) return;
        let frames = 0;
        const tick = () => {
          if (s !== applySeqRef.current) return; // superseded by a newer snapshot
          const cur = latestNodesRef.current;
          const allMeasured = [...touched].every((id) => {
            const n = cur.find((x) => x.id === id);
            return !n || n.measured?.height != null; // a removed node counts as done
          });
          if (!allMeasured && frames < 30) {
            frames++;
            requestAnimationFrame(tick);
            return;
          }
          void layoutCopilotSubgraph({
            nodes: cur,
            edges: latestEdgesRef.current,
            touchedIds: touched,
          }).then((pos) => {
            if (s !== applySeqRef.current || pos.size === 0) return;
            setNodes((nds) =>
              nds.map((n) =>
                pos.has(n.id) ? { ...n, position: pos.get(n.id)! } : n,
              ),
            );
          });
        };
        requestAnimationFrame(tick);
      };

      void layoutCopilotSubgraph({
        nodes: preserved,
        edges: flow.edges,
        touchedIds,
      })
        .then((pos) => {
          if (seq !== applySeqRef.current) return; // superseded by a newer snapshot
          setNodes(
            tag(
              preserved.map((n) =>
                pos.has(n.id) ? { ...n, position: pos.get(n.id)! } : n,
              ),
            ),
          );
          setEdges(taggedEdges);
          // Correct the cluster's spacing once its new nodes measure (org-safe:
          // touched nodes only, existing arrangement untouched).
          relayoutTouchedWhenMeasured(touchedIds, seq);
        })
        .catch(() => {
          if (seq !== applySeqRef.current) return;
          setNodes(preserved);
          setEdges(taggedEdges);
        });
    },
    [takeSnapshot, defMap, outputLabels, resolvedHandles, setNodes, setEdges],
  );

  // Canvas "Tidy up", re-layout the ENTIRE workflow left-to-right (n8n-style),
  // anchored in place. Group/decoration nodes are left untouched.
  const tidyUpGraph = useCallback(() => {
    const seq = ++applySeqRef.current;
    void layoutWholeFlow({
      nodes: latestNodesRef.current,
      edges: latestEdgesRef.current,
    }).then((pos) => {
      if (seq !== applySeqRef.current || pos.size === 0) return;
      takeSnapshot();
      setNodes(
        latestNodesRef.current.map((n) =>
          pos.has(n.id) ? { ...n, position: pos.get(n.id)! } : n,
        ),
      );
    });
  }, [setNodes, takeSnapshot]);

  // Snapshot the live canvas for the copilot to re-hydrate the server session on
  // (re)connect, so a dropped socket never rebuilds from an empty/last-saved graph
  // and wipes what is on screen. Stable: reads the latest nodes/edges via refs.
  const getCopilotGraph = useCallback(
    () => flowToDomain(latestNodesRef.current, latestEdgesRef.current),
    [],
  );

  // Live validity: re-lint the canvas (debounced, position-agnostic) with the
  // EXACT rules the activation gate enforces, so the alerts dropdown always
  // reflects the current graph as the user (or the copilot) edits it.
  const domainGraph = useMemo(() => flowToDomain(nodes, edges), [nodes, edges]);
  const lint = useWorkflowLint({ workflowType, graph: domainGraph });

  // Friendly label for an alert's node chip: prefer the node's own label, fall
  // back to its id (which the copilot names semantically, e.g. "ask_name").
  const nodeLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      const data = n.data as unknown as WorkflowNodeData;
      map.set(n.id, (data?.label as string) || n.id);
    }
    return map;
  }, [nodes]);

  // Select a node from an alert and pan/zoom the canvas to it.
  const focusNode = useCallback((nodeId: string) => {
    const node = latestNodesRef.current.find((n) => n.id === nodeId);
    if (!node) return;
    setSelectedNodeId(nodeId);
    const inst = reactFlowInstance.current;
    if (!inst) return;
    const measured = node.measured as
      | { width?: number; height?: number }
      | undefined;
    const width = measured?.width ?? 220;
    const height = measured?.height ?? 120;
    inst.setCenter(
      node.position.x + width / 2,
      node.position.y + height / 2,
      { zoom: Math.max(inst.getZoom(), 0.9), duration: 450 },
    );
  }, []);

  // ── Canvas search (Ctrl+F) ──────────────────────────────────────────────
  // Distinct node types present on the canvas (excluding group backgrounds),
  // with friendly labels, for the "filter by type" control.
  const searchTypes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const n of nodes) {
      const d = n.data as unknown as WorkflowNodeData;
      if (d.nodeType === "group" || seen.has(d.nodeType)) continue;
      seen.set(d.nodeType, defMap.get(d.nodeType)?.label ?? d.nodeType);
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, z) => a.label.localeCompare(z.label));
  }, [nodes, defMap]);

  // Match any node by id, label, type, or configured value, optionally narrowed
  // to a single type. Group/decoration backgrounds are excluded so they never
  // get highlighted or dimmed.
  const searchMatches = useMemo(() => {
    if (!searchOpen) return [] as string[];
    return matchNodeIds(
      searchQuery,
      nodes
        .filter(
          (n) => (n.data as unknown as WorkflowNodeData).nodeType !== "group",
        )
        .map((n) => {
          const d = n.data as unknown as WorkflowNodeData;
          return {
            id: n.id,
            label: d.label,
            nodeType: d.nodeType,
            config: d.config,
          };
        }),
      { type: searchTypeFilter },
    );
  }, [searchOpen, searchQuery, searchTypeFilter, nodes]);
  // Stable key so the paint/cursor effects don't re-run on mere array identity.
  const searchMatchKey = searchMatches.join(",");

  // Paint transient match/dim flags onto node data. These live only on node.data
  // (never on config), so flowToDomain ignores them: save, lint and copilot sync
  // are all unaffected. Self-clearing when search closes or the query empties.
  useEffect(() => {
    const active =
      searchOpen &&
      (searchQuery.trim().length > 0 || searchTypeFilter != null);
    const matchSet = new Set(searchMatches);
    const hasMatches = matchSet.size > 0;
    setNodes((nds) => {
      let changed = false;
      const next = nds.map((n) => {
        const d = n.data as unknown as WorkflowNodeData;
        const isGroup = d.nodeType === "group";
        const wantMatch = active && matchSet.has(n.id);
        const wantDim = active && hasMatches && !matchSet.has(n.id) && !isGroup;
        if (
          Boolean(d.searchMatch) === wantMatch &&
          Boolean(d.searchDim) === wantDim
        ) {
          return n;
        }
        changed = true;
        return { ...n, data: { ...d, searchMatch: wantMatch, searchDim: wantDim } };
      });
      return changed ? next : nds;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen, searchQuery, searchTypeFilter, searchMatchKey, setNodes]);

  // Reset the cursor whenever the match set changes; a lone match jumps into view
  // automatically (multiple matches stay put and are cycled with Enter/arrows).
  useEffect(() => {
    if (!searchOpen) return;
    if (searchMatches.length === 1) {
      setSearchActiveIndex(0);
      focusNode(searchMatches[0]);
    } else {
      setSearchActiveIndex(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMatchKey, searchOpen]);

  const goToMatch = useCallback(
    (delta: number) => {
      const count = searchMatches.length;
      if (count === 0) return;
      const nextIndex =
        searchActiveIndex < 0
          ? delta > 0
            ? 0
            : count - 1
          : (searchActiveIndex + delta + count) % count;
      setSearchActiveIndex(nextIndex);
      focusNode(searchMatches[nextIndex]);
    },
    [searchMatches, searchActiveIndex, focusNode],
  );

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.select());
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchTypeFilter(null);
    setSearchActiveIndex(-1);
  }, []);

  // Apply workflow metadata the AI copilot sets (name/description/type) so a
  // brand-new workflow built by the AI is named and savable.
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

  // Rename a node's id (e.g. n1 → ask_name). Rewires every connected edge and
  // every {{oldId.…}}/{{oldId}} reference in other nodes' configs so nothing
  // breaks. Returns an error string (shown in the panel) or null on success.
  const renameNode = useCallback(
    (oldId: string, rawNewId: string): string | null => {
      const newId = rawNewId.trim();
      if (!newId) return "O ID não pode ficar vazio.";
      if (newId === oldId) return null;
      if (!/^[A-Za-z0-9_-]+$/.test(newId))
        return "Use apenas letras, números, hífen ou _.";
      if (latestNodesRef.current.some((n) => n.id === newId))
        return "Já existe um nó com esse ID.";

      const renameRefs = (val: unknown): unknown => {
        if (typeof val === "string") {
          return val
            .split(`{{${oldId}.`)
            .join(`{{${newId}.`)
            .split(`{{${oldId}}}`)
            .join(`{{${newId}}}`);
        }
        if (Array.isArray(val)) return val.map(renameRefs);
        if (val && typeof val === "object") {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(val as Record<string, unknown>))
            out[k] = renameRefs(v);
          return out;
        }
        return val;
      };

      takeSnapshot();
      setNodes((nds) =>
        nds.map((n) => {
          const data = n.data as unknown as WorkflowNodeData;
          const nextData = {
            ...data,
            config: renameRefs(data.config ?? {}) as Record<string, unknown>,
          };
          return n.id === oldId
            ? { ...n, id: newId, data: nextData }
            : { ...n, data: nextData };
        }),
      );
      setEdges((eds) =>
        eds.map((e) =>
          e.source === oldId || e.target === oldId
            ? {
                ...e,
                source: e.source === oldId ? newId : e.source,
                target: e.target === oldId ? newId : e.target,
              }
            : e,
        ),
      );
      if (selectedNodeId === oldId) setSelectedNodeId(newId);
      return null;
    },
    [takeSnapshot, setNodes, setEdges, selectedNodeId],
  );

  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    flowPos: { x: number; y: number };
  } | null>(null);

  // Signature of the config that determines a dynamic node's handles, so we only
  // re-ask the backend when something handle-affecting actually changes.
  const handleSig = useMemo(
    () =>
      nodes
        .map((n) => {
          const d = n.data as unknown as WorkflowNodeData;
          if (!dynamicTypes.has(d.nodeType)) return "";
          const c = d.config ?? {};
          // Include every config key that affects a dynamic node's handle set:
          // custom_tools (ai_agent), cases (text_match), and buttons/sections/
          // interactive_type (send buttons/list). Omitting one means the backend
          // is never re-asked and the handles go stale on edit.
          return `${n.id}:${d.nodeType}:${JSON.stringify(
            c.custom_tools ?? null,
          )}:${JSON.stringify(c.cases ?? null)}:${JSON.stringify(
            c.buttons ?? null,
          )}:${JSON.stringify(c.sections ?? null)}:${JSON.stringify(
            c.interactive_type ?? null,
          )}`;
        })
        .filter(Boolean)
        .join("|"),
    [nodes, dynamicTypes],
  );

  // Resolve effect: the backend is the single source of truth for dynamic output
  // handles (ai_agent tool routes + response, text_match cases) and their optional
  // flags. Fetch them (debounced) whenever the handle-affecting config changes;
  // the render effect overlays the result. Uses the latest-nodes ref so this only
  // re-runs when the signature actually changes, not on every node mutation.
  useEffect(() => {
    let cancelled = false;
    const tid = setTimeout(() => {
      const payload = latestNodesRef.current
        .filter((n) =>
          dynamicTypes.has((n.data as unknown as WorkflowNodeData).nodeType),
        )
        .map((n) => {
          const d = n.data as unknown as WorkflowNodeData;
          return { id: n.id, type: d.nodeType, config: d.config ?? {} };
        });
      if (payload.length === 0) {
        setResolvedHandles((prev) => (Object.keys(prev).length ? {} : prev));
        return;
      }
      void resolveHandlesAction(payload).then(({ handles }) => {
        if (!cancelled) setResolvedHandles(handles);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [handleSig, dynamicTypes]);

  // Render effect: overlay the backend-resolved handles (the single source of
  // truth for the handle set AND each handle's optional/required flag) onto every
  // node. Static nodes fall back to their catalog handles. Re-runs whenever the
  // resolved handles arrive (see the resolve effect above) or i18n labels change.
  useEffect(() => {
    if (defMap.size === 0) return;
    setNodes((nds) =>
      nds.map((n) => {
        const d = n.data as unknown as WorkflowNodeData;
        if (d.nodeType === "group") return n;
        const def = defMap.get(d.nodeType);
        if (!def) return n;
        return {
          ...n,
          data: {
            ...d,
            label: ((d.config ?? {}).display_name as string) || def.label,
            icon: def.icon,
            outputs: normalizeOutputs(
              d.nodeType,
              resolvedHandles[n.id] ?? def.outputs,
              outputLabels,
            ),
            hasMissingRequired: checkMissingRequired(
              def,
              d.config ?? {},
              d.nodeType,
            ),
          },
        };
      }),
    );
  }, [defMap, setNodes, outputLabels, resolvedHandles]);

  const prevSimNodeRef = useRef<string | null>(null);
  useEffect(() => {
    const curr = activeSimulation.currentNodeId;
    const prev = prevSimNodeRef.current;
    if (curr === prev) return;
    prevSimNodeRef.current = curr;
    setNodes((nds) =>
      nds.map((n) => {
        const d = n.data as unknown as WorkflowNodeData;
        const shouldSimulate = n.id === curr;
        if (!!d.isSimulating === shouldSimulate) return n;
        return { ...n, data: { ...d, isSimulating: shouldSimulate } };
      }),
    );
  }, [activeSimulation.currentNodeId, setNodes]);

  const nodeTypes: NodeTypes = useMemo(
    () => ({ workflowNode: WorkflowNode, groupNode: GroupNode }),
    [],
  );

  const edgeTypes = useMemo(() => ({ smartBezier: SmartBezierEdge }), []);

  const selectedNode = useMemo(
    () =>
      selectedNodeId
        ? (nodes.find((n) => n.id === selectedNodeId) ?? null)
        : null,
    [nodes, selectedNodeId],
  );

  const isWorkflowDirty = useMemo(() => {
    if (!workflowState) {
      return true;
    }

    const savedWorkflowType: WorkflowType =
      workflowState.type ??
      (workflowState.triggerType
        ? workflowTypeFromTrigger(workflowState.triggerType)
        : "messages");

    const savedSnapshot = createWorkflowSnapshot({
      name: workflowState.name ?? "",
      description: workflowState.description ?? "",
      workflowType: savedWorkflowType,
      graph: workflowState.graph,
    });

    const currentSnapshot = createWorkflowSnapshot({
      name,
      description,
      workflowType,
      graph: flowToDomain(nodes, edges),
    });

    return savedSnapshot !== currentSnapshot;
  }, [workflowState, name, description, workflowType, nodes, edges]);

  const onConnect = useCallback(
    (params: Connection) => {
      takeSnapshot();
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            label: params.sourceHandle || undefined,
            type: "smartBezier",
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
            style: { strokeWidth: 1.5 },
          },
          eds,
        ),
      );
    },
    [setEdges, takeSnapshot],
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData("application/reactflow-type");
      if (!nodeType) return;
      if (!canAddNodeType(nodeType as WorkflowNodeType)) {
        toast.error("Esse nó não está disponível para o gatilho atual.");
        return;
      }
      takeSnapshot();

      const configStr = e.dataTransfer.getData("application/reactflow-config");
      const defaultConfig = configStr ? JSON.parse(configStr) : {};
      const label =
        e.dataTransfer.getData("application/reactflow-label") || undefined;
      const icon =
        e.dataTransfer.getData("application/reactflow-icon") || undefined;
      const def = defMap.get(nodeType as WorkflowNodeType);

      const position = reactFlowInstance.current
        ? reactFlowInstance.current.screenToFlowPosition({
            x: e.clientX,
            y: e.clientY,
          })
        : { x: e.clientX, y: e.clientY };

      if (nodeType === "group") {
        const newNode: Node = {
          id: nextNodeId(),
          type: "groupNode",
          position,
          width: 400,
          height: 250,
          style: { width: 400, height: 250 },
          zIndex: -1,
          data: {
            nodeType: "group" as WorkflowNodeType,
            config: defaultConfig,
            label: label ?? "Grupo",
          } satisfies WorkflowNodeData,
        };
        setNodes((nds) => [...nds, newNode]);
        return;
      }

      const newNode: Node = {
        id: nextNodeId(),
        type: "workflowNode",
        position,
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
        data: {
          nodeType: nodeType as WorkflowNodeType,
          config: defaultConfig,
          label,
          icon,
          // Static catalog handles for now; the resolve effect overlays any
          // config-dependent handles once this node is on the canvas.
          outputs: normalizeOutputs(
            nodeType as WorkflowNodeType,
            def?.outputs,
            outputLabels,
          ),
          hasMissingRequired: checkMissingRequired(
            def,
            defaultConfig,
            nodeType as WorkflowNodeType,
          ),
        } satisfies WorkflowNodeData,
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes, defMap, takeSnapshot, canAddNodeType, outputLabels],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setCtxMenu(null);
  }, []);

  const onPaneContextMenu = useCallback((e: MouseEvent | React.MouseEvent) => {
    e.preventDefault();
    const clientX = "clientX" in e ? e.clientX : 0;
    const clientY = "clientY" in e ? e.clientY : 0;
    const flowPos = reactFlowInstance.current
      ? reactFlowInstance.current.screenToFlowPosition({
          x: clientX,
          y: clientY,
        })
      : { x: clientX, y: clientY };
    setCtxMenu({ x: clientX, y: clientY, flowPos });
  }, []);

  const onCtxMenuSelect = useCallback(
    (def: NodeDefinition) => {
      if (!ctxMenu) return;
      if (!canAddNodeType(def.type as WorkflowNodeType)) {
        toast.error("Esse nó não está disponível para o gatilho atual.");
        setCtxMenu(null);
        return;
      }
      takeSnapshot();
      const newNode: Node = {
        id: nextNodeId(),
        type: def.type === "group" ? "groupNode" : "workflowNode",
        position: ctxMenu.flowPos,
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
        ...(def.type === "group"
          ? {
              width: 400,
              height: 250,
              style: { width: 400, height: 250 },
              zIndex: -1,
            }
          : {}),
        data: {
          nodeType: def.type as WorkflowNodeType,
          config: { ...(def.defaultConfig ?? {}) },
          label: def.label,
          icon: def.icon,
          // Static catalog handles for now; the resolve effect overlays any
          // config-dependent handles once this node is on the canvas.
          outputs: normalizeOutputs(
            def.type as WorkflowNodeType,
            def.outputs,
            outputLabels,
          ),
          hasMissingRequired: checkMissingRequired(
            def,
            def.defaultConfig ?? {},
            def.type as WorkflowNodeType,
          ),
        } satisfies WorkflowNodeData,
      };
      setNodes((nds) => [...nds, newNode]);
      setCtxMenu(null);
    },
    [ctxMenu, takeSnapshot, setNodes, canAddNodeType, outputLabels],
  );

  const wrappedOnNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      const hasRemove = changes.some((c) => c.type === "remove");
      if (hasRemove) takeSnapshot();
      onNodesChange(changes);
    },
    [onNodesChange, takeSnapshot],
  );

  const wrappedOnEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      const hasRemove = changes.some((c) => c.type === "remove");
      if (hasRemove) takeSnapshot();
      onEdgesChange(changes);
    },
    [onEdgesChange, takeSnapshot],
  );

  const onConfigChange = useCallback(
    (nodeId: string, config: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const d = n.data as unknown as WorkflowNodeData;

          if (d.nodeType === "group") {
            return {
              ...n,
              data: {
                ...n.data,
                config,
                label: (config.display_name as string) || "Grupo",
              },
            };
          }

          const def = defMap.get(d.nodeType);
          const updatedData: Record<string, unknown> = {
            ...n.data,
            config,
            label: (config.display_name as string) || def?.label || d.label,
            // Output handles are owned by the backend (resolved via the effect
            // below). Keep the current handles here; if this config change affects
            // them, the resolve effect refreshes them, the frontend never
            // recomputes the handle set or its optional flags.
            outputs: d.outputs,
            hasMissingRequired: checkMissingRequired(def, config, d.nodeType),
          };
          return { ...n, data: updatedData };
        }),
      );
    },
    [setNodes, defMap],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    takeSnapshot();
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) =>
      eds.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId,
      ),
    );
    setSelectedNodeId(null);
  }, [selectedNodeId, setNodes, setEdges, takeSnapshot]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Node search overrides the browser find, and works even from inside an
      // input, so it sits ahead of the "ignore while typing" guard below.
      if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.key === "Escape" && searchOpen) {
        e.preventDefault();
        closeSearch();
        return;
      }

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        if (!selectedNodeId) return;
        const node = nodes.find((n) => n.id === selectedNodeId);
        if (!node) return;
        const d = node.data as unknown as WorkflowNodeData;
        if (d.nodeType.startsWith("trigger_") || d.nodeType === "end") return;
        clipboardRef.current = {
          nodeType: d.nodeType,
          label: d.label,
          icon: d.icon,
        };
        toast.success("Nó copiado");
        e.preventDefault();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        if (!clipboardRef.current) return;
        if (!canAddNodeType(clipboardRef.current.nodeType)) {
          toast.error("Esse nó não está disponível para o gatilho atual.");
          e.preventDefault();
          return;
        }
        takeSnapshot();
        const { nodeType, label, icon } = clipboardRef.current;
        const def = defMap.get(nodeType);
        const defaultConfig = def?.defaultConfig ?? {};

        const position = reactFlowInstance.current
          ? reactFlowInstance.current.screenToFlowPosition(mousePosRef.current)
          : mousePosRef.current;

        const newNode: Node = {
          id: nextNodeId(),
          type: "workflowNode",
          position,
          targetPosition: Position.Left,
          sourcePosition: Position.Right,
          data: {
            nodeType,
            config: { ...defaultConfig },
            label,
            icon,
            // Static catalog handles for now; the resolve effect overlays any
            // config-dependent handles once this node is on the canvas.
            outputs: normalizeOutputs(nodeType, def?.outputs, outputLabels),
            hasMissingRequired: checkMissingRequired(
              def,
              defaultConfig,
              nodeType,
            ),
          } satisfies WorkflowNodeData,
        };

        setNodes((nds) => [...nds, newNode]);
        toast.success("Nó colado");
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedNodeId,
    nodes,
    defMap,
    setNodes,
    undo,
    redo,
    takeSnapshot,
    canAddNodeType,
    outputLabels,
    searchOpen,
    openSearch,
    closeSearch,
  ]);

  const validateGraphForType = (graph: WorkflowGraph): string | null => {
    const triggerNodes = graph.nodes.filter(
      (n) => triggerWorkflowTypeFromDef(defMap.get(n.type)) !== null,
    );
    const seen = new Set<string>();
    for (const node of triggerNodes) {
      const nodeWfType = triggerWorkflowTypeFromDef(defMap.get(node.type));
      if (nodeWfType !== workflowType) {
        const triggerLabel = triggerLabelByType.get(node.type) ?? node.type;
        const typeLabel = t(`workflowTypeOption.${workflowType}`);
        return t("validation.incompatibleTrigger", {
          trigger: triggerLabel,
          type: typeLabel,
        });
      }
      if (seen.has(node.type)) {
        const triggerLabel = triggerLabelByType.get(node.type) ?? node.type;
        return t("validation.duplicateTrigger", { trigger: triggerLabel });
      }
      seen.add(node.type);
    }
    if (triggerNodes.length === 0) {
      return t("validation.missingTrigger");
    }
    return null;
  };

  const derivePrimaryTriggerType = (
    graph: WorkflowGraph,
  ): WorkflowTriggerType | undefined => {
    const priority: WorkflowTriggerType[] = [
      "trigger_first_message",
      "trigger_message_received",
    ];
    const present = new Set(graph.nodes.map((n) => n.type as string));
    for (const tt of priority) {
      if (present.has(tt)) return tt;
    }
    for (const n of graph.nodes) {
      if (defMap.get(n.type)?.category === "trigger") {
        return n.type as WorkflowTriggerType;
      }
    }
    return undefined;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t("validation.nameRequired"));
      return;
    }

    const graph = flowToDomain(nodes, edges);
    const validationError = validateGraphForType(graph);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const derivedTrigger = derivePrimaryTriggerType(graph);

    if (!workflowState?.id) {
      const payload: CreateWorkflowPayload = {
        name: name.trim(),
        description: description.trim(),
        type: workflowType,
        triggerType: derivedTrigger,
        graph,
      };
      const result = await createWorkflowAction(payload);
      if (result.error) {
        toast.error(result.error);
      } else if (result.workflow) {
        toast.success(t("saved"));
        // Keep the editor (and any open AI copilot session) mounted: update state
        // in place and rewrite the URL shallowly instead of navigating, which
        // would remount the page and drop the builder session.
        setWorkflowState(result.workflow);
        onWorkflowUpdate?.(result.workflow);
        if (typeof window !== "undefined") {
          window.history.replaceState(
            null,
            "",
            window.location.pathname.replace(
              /\/new\/?$/,
              `/${result.workflow.id}`,
            ),
          );
        }
      }
    } else if (workflowState) {
      const payload: UpdateWorkflowPayload = {
        name: name.trim(),
        description: description.trim(),
        type: workflowType,
        triggerType: derivedTrigger,
        graph,
      };

      if (workflowState.status === "active") {
        const pauseResult = await pauseWorkflowAction(workflowState.id);
        if (pauseResult.error) {
          toast.error(pauseResult.error);
          setSaving(false);
          return;
        }
      }

      const result = await updateWorkflowAction(workflowState.id, payload);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("saved"));
        const latest = await getWorkflowAction(workflowState.id);
        if (latest.workflow) {
          setWorkflowState(latest.workflow);
          onWorkflowUpdate?.(latest.workflow);
        }
      }
    }
    setSaving(false);
  };

  const handleActivate = async () => {
    if (!workflowState) return;
    const result = await activateWorkflowAction(workflowState.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("activated"));
      if (result.workflow) {
        setWorkflowState(result.workflow);
        onWorkflowUpdate?.(result.workflow);
      }
    }
  };

  const handlePause = async () => {
    if (!workflowState) return;
    const result = await pauseWorkflowAction(workflowState.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("paused"));
      if (result.workflow) {
        setWorkflowState(result.workflow);
        onWorkflowUpdate?.(result.workflow);
      }
    }
  };

  const handleDelete = async () => {
    if (!workflowState) return;
    const result = await deleteWorkflowAction(workflowState.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("deleted"));
      router.push("/dashboard/workflows");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] overflow-hidden">
      {/* ─── Top Bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
        <ElevatedButton
          variant="ghost"
          size="icon"
          icon={<ArrowLeft size={16} />}
          iconVisible
          onClick={() => router.push("/dashboard/workflows")}
        />

        <ElevatedInput
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setName(e.target.value)
          }
          label={t("namePlaceholder")}
          controlSize="sm"
          className="w-56"
        />

        <ElevatedInput
          value={description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setDescription(e.target.value)
          }
          label={t("descriptionPlaceholder")}
          controlSize="sm"
          className="w-56"
        />

        <ElevatedSelect
          value={workflowType}
          onValueChange={(val) => {
            const nextType = val as WorkflowType;
            if (nextType === workflowType) return;
            if (showTestPanel) {
              simulation.cancel();
              setShowTestPanel(false);
            }
            setWorkflowType(nextType);
          }}
          label={t("workflowType")}
          className="w-48"
        >
          {workflowTypeOptions.map((opt) => (
            <ElevatedSelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>

        <div className="flex-1" />

        <ElevatedButton
          variant={showCopilot ? "primary" : "outline-subtle"}
          size="sm"
          title="Copiloto de IA"
          icon={<Sparkle size={14} weight="fill" />}
          iconVisible
          onClick={() => {
            setCopilotMounted(true);
            setShowCopilot((v) => !v);
          }}
        />

        {workflowState?.id && (
          <ElevatedButton
            variant={showTestPanel ? "primary" : "outline-subtle"}
            size="sm"
            title="Testar"
            icon={<TestTube size={14} weight="fill" />}
            iconVisible
            onClick={() => {
              if (showTestPanel) {
                activeSimulation.cancel();
                setShowTestPanel(false);
                return;
              }
              setShowTestPanel(true);
            }}
          />
        )}

        <WorkflowAlerts
          valid={lint.valid}
          issues={lint.issues}
          linting={lint.linting}
          nodeLabel={(id) => nodeLabelById.get(id)}
          onFocusNode={focusNode}
        />

        {workflowState && workflowState.status !== "active" ? (
          <ElevatedButton
            variant="outline-subtle"
            size="sm"
            title={t("activate")}
            icon={<Play size={14} weight="fill" />}
            iconVisible
            onClick={handleActivate}
          />
        ) : workflowState?.status === "active" ? (
          <ElevatedButton
            variant="outline-subtle"
            size="sm"
            title={t("pause")}
            icon={<Pause size={14} weight="fill" />}
            iconVisible
            onClick={handlePause}
          />
        ) : null}

        <ElevatedButton
          variant="primary"
          size="sm"
          title={saving ? t("saving") : t("save")}
          icon={<FloppyDisk size={14} weight="fill" />}
          iconVisible
          onClick={handleSave}
          disabled={saving}
        />

        {/* Secondary / destructive actions live in an overflow menu so the top
            bar stays focused on the primary controls. */}
        {workflowState && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ElevatedButton
                  variant="outline-subtle"
                  size="sm"
                  title="Mais ações"
                  icon={<DotsThreeVertical size={16} weight="bold" />}
                  iconVisible
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {workflowState.id && (
                  <DropdownMenuItem
                    className="rounded-lg border-l-0"
                    onSelect={() =>
                      window.open(
                        `${getApiBaseUrl()}/workflows/${encodeURIComponent(workflowState.id)}/export`,
                        "_blank",
                      )
                    }
                  >
                    <Upload weight="bold" />
                    {t("export")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="rounded-lg border-l-0 text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive dark:text-destructive"
                  onSelect={() => setConfirmDeleteOpen(true)}
                >
                  <Trash />
                  Excluir workflow
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ConfirmDialog
              open={confirmDeleteOpen}
              onOpenChange={setConfirmDeleteOpen}
              title="Excluir workflow"
              description="Tem certeza que deseja excluir este workflow? Esta ação não pode ser desfeita."
              confirmLabel="Excluir"
              tone="danger"
              onConfirm={handleDelete}
            />
          </>
        )}
      </div>

      {/* ─── Canvas ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette definitions={availableDefinitions} />

        <div
          ref={reactFlowWrapper}
          className="flex-1"
          onDragOver={onDragOver}
          onDrop={onDrop}
          onMouseMove={onMouseMove}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={wrappedOnNodesChange}
            onEdgesChange={wrappedOnEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onPaneContextMenu={onPaneContextMenu}
            onInit={(instance) => {
              reactFlowInstance.current = instance;
            }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionLineComponent={SmartConnectionLine}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={1.75}
            elevateNodesOnSelect={false}
            deleteKeyCode={["Backspace", "Delete"]}
            className="bg-card"
            defaultEdgeOptions={{
              type: "smartBezier",
              animated: false,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 16,
                height: 16,
              },
              style: {
                strokeWidth: 1.5,
                stroke: "hsl(var(--muted-foreground)/0.5)",
              },
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color={resolvedTheme === "dark" ? "white" : "black"}
            />
            <Controls className="!bg-background !border-border !shadow-md [&>button]:!bg-background [&>button]:!border-border [&>button]:!fill-foreground">
              <ControlButton onClick={tidyUpGraph} title={t("tidyUp")}>
                <TreeStructure />
              </ControlButton>
              <ControlButton onClick={openSearch} title="Buscar nós (Ctrl+F)">
                <MagnifyingGlass />
              </ControlButton>
            </Controls>
            <MiniMap
              className="!bg-background !border-border border-black border rounded"
              nodeColor="hsl(var(--primary))"
              maskColor="hsl(var(--muted) / 0.7)"
            />

            {/* Brand watermark */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[5] opacity-35 pointer-events-none select-none">
              <BrandLogo
                useWhite={resolvedTheme === "dark"}
                size="sm"
                textClassName="text-muted-foreground"
              />
            </div>

            {selectedNodeId && (
              <Panel position="top-right">
                <ElevatedButton
                  variant="outline-subtle"
                  size="sm"
                  title={t("deleteNode")}
                  icon={<Trash size={14} />}
                  iconVisible
                  onClick={deleteSelected}
                  className="text-destructive border-rose-300 hover:bg-destructive/10"
                />
              </Panel>
            )}

            {/* Node search (Ctrl+F) */}
            {searchOpen && (
              <Panel position="top-center">
                <WorkflowSearch
                  ref={searchInputRef}
                  query={searchQuery}
                  onQueryChange={setSearchQuery}
                  matchCount={searchMatches.length}
                  activeIndex={searchActiveIndex}
                  onNext={() => goToMatch(1)}
                  onPrev={() => goToMatch(-1)}
                  onClose={closeSearch}
                  types={searchTypes}
                  typeFilter={searchTypeFilter}
                  onTypeFilterChange={setSearchTypeFilter}
                />
              </Panel>
            )}

            {/* Undo / Redo */}
            <Panel position="top-left">
              <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-0.5 shadow-sm">
                <button
                  onClick={undo}
                  title="Desfazer (Ctrl+Z)"
                  className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowCounterClockwise size={15} weight="bold" />
                </button>
                <button
                  onClick={redo}
                  title="Refazer (Ctrl+Y)"
                  className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowClockwise size={15} weight="bold" />
                </button>
              </div>
            </Panel>
          </ReactFlow>

          {/* Right-click context menu */}
          {ctxMenu && (
            <CanvasContextMenu
              x={ctxMenu.x}
              y={ctxMenu.y}
              definitions={availableDefinitions}
              onSelect={onCtxMenuSelect}
              onClose={() => setCtxMenu(null)}
            />
          )}
        </div>

        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            workflowId={workflowState?.id ?? null}
            workspaceId={workflowState?.workspaceId ?? null}
            isWorkflowDirty={isWorkflowDirty}
            definitions={definitions}
            allNodes={nodes}
            allEdges={edges}
            onClose={() => setSelectedNodeId(null)}
            onConfigChange={onConfigChange}
            onRenameNode={renameNode}
          />
        )}

        {showTestPanel && workflowState && (
          <WorkflowTestPanel
            simulation={simulation}
            onClose={() => {
              simulation.cancel();
              setShowTestPanel(false);
            }}
          />
        )}

        {copilotMounted && (
          <WorkflowCopilotPanel
            visible={showCopilot}
            workflowId={workflowState?.id ?? ""}
            workflowType={workflowType}
            onGraph={applyCopilotGraph}
            onMeta={applyCopilotMeta}
            getGraph={getCopilotGraph}
            onClose={() => setShowCopilot(false)}
          />
        )}
      </div>
    </div>
  );
}
