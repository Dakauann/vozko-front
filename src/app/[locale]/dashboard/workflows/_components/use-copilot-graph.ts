"use client";

import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Edge, Node } from "@xyflow/react";

import type { HandleDefinition, NodeDefinition, WorkflowGraph } from "@/lib/workflows/types";

import { layoutCopilotSubgraph, layoutWholeFlow } from "./copilot-layout";
import { copilotNodeSig, domainToFlow, type OutputLabels } from "./editor-flow";
import { flowToDomain } from "./workflow-graph";

interface CopilotGraphInput {
  showCopilot: boolean;
  takeSnapshot: () => void;
  defMap: Map<string, NodeDefinition>;
  outputLabels: OutputLabels;
  resolvedHandles: Record<string, HandleDefinition[]>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  latestNodesRef: RefObject<Node[]>;
  latestEdgesRef: RefObject<Edge[]>;
}

export function useCopilotGraph({
  showCopilot,
  takeSnapshot,
  defMap,
  outputLabels,
  resolvedHandles,
  setNodes,
  setEdges,
  latestNodesRef,
  latestEdgesRef,
}: CopilotGraphInput) {
  const copilotBaselineRef = useRef<Set<string> | null>(null);
  const applySeqRef = useRef(0);
  const appearedIdsRef = useRef<Set<string>>(new Set());
  const appearedEdgeIdsRef = useRef<Set<string>>(new Set());
  const nodeSigRef = useRef<Map<string, string>>(new Map());
  const flashCounterRef = useRef(0);
  useEffect(() => {
    if (showCopilot) {
      const cur = latestNodesRef.current;
      copilotBaselineRef.current = new Set(cur.map((n) => n.id));
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
  }, [showCopilot, latestNodesRef, latestEdgesRef]);

  const applyCopilotGraph = useCallback(
    (graph: WorkflowGraph) => {
      takeSnapshot();
      const flow = domainToFlow(graph, defMap, outputLabels, resolvedHandles);
      const baseline = copilotBaselineRef.current ?? new Set<string>();
      const currentPos = new Map(
        latestNodesRef.current.map((n) => [n.id, n.position]),
      );
      const preserved = flow.nodes.map((n) =>
        baseline.has(n.id) && currentPos.has(n.id)
          ? { ...n, position: currentPos.get(n.id)! }
          : n,
      );
      const touchedIds = new Set(
        preserved.filter((n) => !baseline.has(n.id)).map((n) => n.id),
      );

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
      const relayoutTouchedWhenMeasured = (touched: Set<string>, s: number) => {
        if (touched.size === 0) return;
        let frames = 0;
        const tick = () => {
          if (s !== applySeqRef.current) return;
          const cur = latestNodesRef.current;
          const allMeasured = [...touched].every((id) => {
            const n = cur.find((x) => x.id === id);
            return !n || n.measured?.height != null;
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
          if (seq !== applySeqRef.current) return;
          setNodes(
            tag(
              preserved.map((n) =>
                pos.has(n.id) ? { ...n, position: pos.get(n.id)! } : n,
              ),
            ),
          );
          setEdges(taggedEdges);
          relayoutTouchedWhenMeasured(touchedIds, seq);
        })
        .catch(() => {
          if (seq !== applySeqRef.current) return;
          setNodes(preserved);
          setEdges(taggedEdges);
        });
    },
    [takeSnapshot, defMap, outputLabels, resolvedHandles, setNodes, setEdges, latestNodesRef, latestEdgesRef],
  );

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
  }, [setNodes, takeSnapshot, latestNodesRef, latestEdgesRef]);

  const getCopilotGraph = useCallback(
    () => flowToDomain(latestNodesRef.current, latestEdgesRef.current),
    [latestNodesRef, latestEdgesRef],
  );

  return { applyCopilotGraph, tidyUpGraph, getCopilotGraph };
}
