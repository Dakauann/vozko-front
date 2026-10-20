"use client";

import { useCallback, useState, type DragEvent, type Dispatch, type RefObject, type SetStateAction } from "react";
import {
  addEdge,
  MarkerType,
  type Connection,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import { toast } from "sonner";

import type { NodeDefinition, WorkflowNodeType } from "@/lib/workflows/types";

import type { PaneMenuState } from "./editor-canvas";
import { checkMissingRequired, reconnectedEdges, workflowFlowNode, type OutputLabels } from "./editor-flow";
import type { WorkflowNodeData } from "./workflow-node";

interface NodeEditingInput {
  defMap: Map<string, NodeDefinition>;
  outputLabels: OutputLabels;
  canAddNodeType: (nodeType: WorkflowNodeType) => boolean;
  takeSnapshot: () => void;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  freshNodeId: () => string;
  reactFlowInstance: RefObject<ReactFlowInstance | null>;
  latestNodesRef: RefObject<Node[]>;
  setConfigNodeId: Dispatch<SetStateAction<string | null>>;
}

export function useNodeEditing({
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
}: NodeEditingInput) {
  const [ctxMenu, setCtxMenu] = useState<PaneMenuState | null>(null);

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

  const onReconnect = useCallback(
    (previous: Edge, connection: Connection) => {
      takeSnapshot();
      setEdges((eds) => reconnectedEdges(eds, previous, connection));
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
          id: freshNodeId(),
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

      const newNode = workflowFlowNode({
        id: freshNodeId(),
        nodeType: nodeType as WorkflowNodeType,
        position,
        config: defaultConfig,
        label,
        icon,
        def,
        outputLabels,
      });

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes, defMap, takeSnapshot, canAddNodeType, outputLabels, freshNodeId, reactFlowInstance],
  );

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
  }, [reactFlowInstance]);

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
        ...workflowFlowNode({
          id: freshNodeId(),
          nodeType: def.type as WorkflowNodeType,
          position: ctxMenu.flowPos,
          config: { ...(def.defaultConfig ?? {}) },
          label: def.label,
          icon: def.icon,
          def,
          outputLabels,
        }),
        ...(def.type === "group"
          ? {
              type: "groupNode",
              width: 400,
              height: 250,
              style: { width: 400, height: 250 },
              zIndex: -1,
            }
          : {}),
      };
      setNodes((nds) => [...nds, newNode]);
      setCtxMenu(null);
    },
    [ctxMenu, takeSnapshot, setNodes, canAddNodeType, outputLabels, freshNodeId],
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
            outputs: d.outputs,
            hasMissingRequired: checkMissingRequired(def, config, d.nodeType),
          };
          return { ...n, data: updatedData };
        }),
      );
    },
    [setNodes, defMap],
  );

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
      setConfigNodeId((current) => (current === oldId ? newId : current));
      return null;
    },
    [takeSnapshot, setNodes, setEdges, latestNodesRef, setConfigNodeId],
  );

  const deleteSelected = useCallback(() => {
    const instance = reactFlowInstance.current;
    if (!instance) return;
    const nodes = instance.getNodes().filter((n) => n.selected);
    const edges = instance.getEdges().filter((e) => e.selected);
    if (nodes.length === 0 && edges.length === 0) return;
    void instance.deleteElements({ nodes, edges });
  }, [reactFlowInstance]);

  const closePaneMenu = useCallback(() => setCtxMenu(null), []);

  return {
    ctxMenu,
    setCtxMenu,
    closePaneMenu,
    onConnect,
    onReconnect,
    onDragOver,
    onDrop,
    onPaneContextMenu,
    onCtxMenuSelect,
    wrappedOnNodesChange,
    wrappedOnEdgesChange,
    onConfigChange,
    renameNode,
    deleteSelected,
  };
}
