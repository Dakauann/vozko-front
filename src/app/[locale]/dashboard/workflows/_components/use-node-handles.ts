"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Node } from "@xyflow/react";
import { toast } from "sonner";

import { resolveHandlesAction } from "@/app/actions/workflows";
import { acceptHandles, handleRequestOf, seedHandleCache, type HandleCache, type HandleNode } from "@/lib/workflows/handle-requests";
import type { HandleDefinition, NodeDefinition } from "@/lib/workflows/types";

import { checkMissingRequired, normalizeOutputs, type OutputLabels } from "./editor-flow";
import type { WorkflowNodeData } from "./workflow-node";

interface NodeHandlesInput {
  definitions: NodeDefinition[];
  defMap: Map<string, NodeDefinition>;
  structureNodes: Node[];
  latestNodesRef: RefObject<Node[]>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  outputLabels: OutputLabels;
  initialHandles?: Record<string, HandleDefinition[]>;
}

const HANDLES_REFRESH_FAILED = "Não foi possível atualizar as saídas dos nós. As últimas saídas conhecidas continuam no canvas.";

function handleNodesOf(nodes: Node[], dynamicTypes: Set<string>): HandleNode[] {
  return nodes
    .filter((n) => dynamicTypes.has((n.data as unknown as WorkflowNodeData).nodeType))
    .map((n) => {
      const d = n.data as unknown as WorkflowNodeData;
      return { id: n.id, type: d.nodeType, config: d.config ?? {} };
    });
}

export function useNodeHandles({
  definitions,
  defMap,
  structureNodes,
  latestNodesRef,
  setNodes,
  outputLabels,
  initialHandles,
}: NodeHandlesInput): Record<string, HandleDefinition[]> {
  const dynamicTypes = useMemo(
    () => new Set(definitions.filter((d) => d.dynamicHandles).map((d) => d.type as string)),
    [definitions],
  );
  const [openedWith] = useState(() => seedHandleCache(initialHandles ?? {}, handleNodesOf(structureNodes, dynamicTypes)));
  const cacheRef = useRef<HandleCache>(openedWith);
  const sequenceRef = useRef(0);
  const failedRef = useRef(false);
  const [resolvedHandles, setResolvedHandles] = useState<Record<string, HandleDefinition[]>>(initialHandles ?? {});

  const handleSig = useMemo(
    () =>
      handleNodesOf(structureNodes, dynamicTypes)
        .map((n) => `${n.id}:${n.type}:${JSON.stringify(n.config)}`)
        .join("|"),
    [structureNodes, dynamicTypes],
  );

  useEffect(() => {
    const tid = setTimeout(() => {
      const nodes = handleNodesOf(latestNodesRef.current, dynamicTypes);
      const { cache, send } = handleRequestOf(cacheRef.current, nodes);
      cacheRef.current = cache;
      if (send.length === 0) {
        setResolvedHandles((prev) => (sameHandles(prev, cache.handles) ? prev : cache.handles));
        return;
      }
      const sequence = ++sequenceRef.current;
      void resolveHandlesAction(send).then((result) => {
        if (sequence !== sequenceRef.current) return;
        if (result.error) {
          if (!failedRef.current) toast.error(HANDLES_REFRESH_FAILED);
          failedRef.current = true;
          return;
        }
        failedRef.current = false;
        cacheRef.current = acceptHandles(cacheRef.current, send, result.handles);
        setResolvedHandles(cacheRef.current.handles);
      });
    }, 250);
    return () => clearTimeout(tid);
  }, [handleSig, dynamicTypes, latestNodesRef]);

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

  return resolvedHandles;
}

function sameHandles(a: Record<string, HandleDefinition[]>, b: Record<string, HandleDefinition[]>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}
