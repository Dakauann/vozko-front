"use client";

import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Edge, Node, ReactFlowInstance } from "@xyflow/react";
import { toast } from "sonner";

import { isSingleInstanceBehavior, testBehaviorOf } from "@/lib/workflows/node-test-behavior";
import type { NodeDefinition, WorkflowNodeType } from "@/lib/workflows/types";

import { copiedSelection, pastedSelection, type CanvasClipboard } from "./canvas-clipboard";
import type { OutputLabels } from "./editor-flow";

interface EditorShortcutsInput {
  configOpen: boolean;
  openConfig: (nodeId: string) => void;
  defMap: Map<string, NodeDefinition>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  undo: () => void;
  redo: () => void;
  takeSnapshot: () => void;
  canAddNodeType: (nodeType: WorkflowNodeType) => boolean;
  outputLabels: OutputLabels;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  latestNodesRef: RefObject<Node[]>;
  latestEdgesRef: RefObject<Edge[]>;
  reactFlowInstance: RefObject<ReactFlowInstance | null>;
  mousePosRef: RefObject<{ x: number; y: number }>;
  saveNow: () => void;
}

function soleSelectedNode(nodes: Node[]): Node | null {
  const selected = nodes.filter((n) => n.selected);
  return selected.length === 1 ? selected[0] : null;
}

function nodeIdToConfigure(target: EventTarget | null, nodes: Node[]): string | null {
  if (target instanceof HTMLElement && target.classList.contains("react-flow__node")) return target.dataset.id ?? null;
  if (target !== document.body) return null;
  return soleSelectedNode(nodes)?.id ?? null;
}

function plainKey(e: KeyboardEvent): boolean {
  return !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
}

export function useEditorShortcuts({
  configOpen,
  openConfig,
  defMap,
  setNodes,
  setEdges,
  undo,
  redo,
  takeSnapshot,
  canAddNodeType,
  outputLabels,
  searchOpen,
  openSearch,
  closeSearch,
  latestNodesRef,
  latestEdgesRef,
  reactFlowInstance,
  mousePosRef,
  saveNow,
}: EditorShortcutsInput) {
  const clipboardRef = useRef<CanvasClipboard | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        saveNow();
        return;
      }
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

      if (e.key === "Enter" && plainKey(e) && !configOpen) {
        const nodeId = nodeIdToConfigure(e.target, latestNodesRef.current);
        if (!nodeId) return;
        e.preventDefault();
        openConfig(nodeId);
        return;
      }

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
        const copied = copiedSelection(latestNodesRef.current, latestEdgesRef.current, (nodeType) => !isSingleInstanceBehavior(testBehaviorOf(defMap, nodeType)));
        if (!copied) return;
        clipboardRef.current = copied;
        toast.success(copied.nodes.length === 1 ? "Nó copiado" : `${copied.nodes.length} nós copiados`);
        e.preventDefault();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        const clipboard = clipboardRef.current;
        if (!clipboard) return;
        e.preventDefault();
        if (!clipboard.nodes.every((node) => canAddNodeType(node.nodeType))) {
          toast.error("Esse nó não está disponível para o gatilho atual.");
          return;
        }
        const anchor = reactFlowInstance.current ? reactFlowInstance.current.screenToFlowPosition(mousePosRef.current) : mousePosRef.current;
        const pasted = pastedSelection(clipboard, { anchor, takenIds: latestNodesRef.current.map((node) => node.id), defMap, outputLabels });
        takeSnapshot();
        setNodes((nds) => [...nds.map((node) => (node.selected ? { ...node, selected: false } : node)), ...pasted.nodes]);
        setEdges((eds) => [...eds.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)), ...pasted.edges]);
        toast.success(pasted.nodes.length === 1 ? "Nó colado" : `${pasted.nodes.length} nós colados`);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    configOpen,
    openConfig,
    defMap,
    setNodes,
    setEdges,
    undo,
    redo,
    takeSnapshot,
    canAddNodeType,
    outputLabels,
    searchOpen,
    openSearch,
    closeSearch,
    latestNodesRef,
    latestEdgesRef,
    reactFlowInstance,
    mousePosRef,
    saveNow,
  ]);
}
