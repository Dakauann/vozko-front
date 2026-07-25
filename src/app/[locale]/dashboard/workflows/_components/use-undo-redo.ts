"use client";

import { useCallback, useRef } from "react";
import type { Node, Edge } from "@xyflow/react";

interface Snapshot {
    nodes: Node[];
    edges: Edge[];
}

const MAX_HISTORY = 50;

export function useUndoRedo(
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
) {
    const pastRef = useRef<Snapshot[]>([]);
    const futureRef = useRef<Snapshot[]>([]);
    const currentRef = useRef<Snapshot>({ nodes: [], edges: [] });

    const syncCurrent = useCallback((nodes: Node[], edges: Edge[]) => {
        currentRef.current = { nodes, edges };
    }, []);

    const takeSnapshot = useCallback(() => {
        const snap: Snapshot = {
            nodes: currentRef.current.nodes.map((n) => ({ ...n, data: { ...n.data } })),
            edges: currentRef.current.edges.map((e) => ({ ...e })),
        };
        pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), snap];
        futureRef.current = []; 
    }, []);

    const undo = useCallback(() => {
        const past = pastRef.current;
        if (past.length === 0) return;

        const previous = past[past.length - 1];
        pastRef.current = past.slice(0, -1);

        futureRef.current = [
            ...futureRef.current,
            {
                nodes: currentRef.current.nodes.map((n) => ({ ...n, data: { ...n.data } })),
                edges: currentRef.current.edges.map((e) => ({ ...e })),
            },
        ];

        setNodes(previous.nodes);
        setEdges(previous.edges);
    }, [setNodes, setEdges]);

    const redo = useCallback(() => {
        const future = futureRef.current;
        if (future.length === 0) return;

        const next = future[future.length - 1];
        futureRef.current = future.slice(0, -1);

        pastRef.current = [
            ...pastRef.current,
            {
                nodes: currentRef.current.nodes.map((n) => ({ ...n, data: { ...n.data } })),
                edges: currentRef.current.edges.map((e) => ({ ...e })),
            },
        ];

        setNodes(next.nodes);
        setEdges(next.edges);
    }, [setNodes, setEdges]);

    const canUndo = useCallback(() => pastRef.current.length > 0, []);
    const canRedo = useCallback(() => futureRef.current.length > 0, []);

    return { takeSnapshot, undo, redo, canUndo, canRedo, syncCurrent };
}
