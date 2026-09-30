"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useWorkspace } from "@/contexts/workspace-context";

const WS_BASE_URL =
    process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";


export type SimStatus = "idle" | "connecting" | "waiting_trigger" | "running" | "waiting_reply" | "waiting_key" | "completed" | "error" | "cancelled";

const LIVE_STATUSES: SimStatus[] = ["running", "waiting_reply", "waiting_trigger", "waiting_key"];

export interface SimNodeEvent {
    type: "node_event";
    nodeId: string;
    nodeType: string;
    output?: Record<string, unknown>;
    error?: string;
}

export interface SimMessage {
    type: "message";
    direction: "outbound" | "inbound";
    text: string;
    msgType: string;
    nodeId?: string;
    messageId: string;
    audioBase64?: string;
    audioMime?: string;
    audioUrl?: string;
}

export interface SimWaitingKey {
    type: "waiting_key";
    timeoutSeconds: number;
}

export interface SimCallTransferred {
    type: "call_transferred";
    queueId: string;
    queueName: string;
    notes?: string;
}

export interface SimWaitingReply {
    type: "waiting_reply";
    nodeId: string;
    timeoutSeconds: number;
}

export interface SimStateUpdate {
    type: "state";
    vars: Record<string, unknown>;
}

export interface SimError {
    type: "error";
    message: string;
}

export type SimEvent = SimNodeEvent | SimMessage | SimWaitingReply | SimWaitingKey | SimCallTransferred | SimStateUpdate | SimError;


interface UseWorkflowSimulationOptions {
    workflowId: string;
}

export interface UseWorkflowSimulationReturn {
    status: SimStatus;
    events: SimEvent[];
    currentNodeId: string | null;
    stateVars: Record<string, unknown>;
    start: () => void;
    sendReply: (text: string) => void;
    sendKey: (key: string) => void;
    cancel: () => void;
}

export function useWorkflowSimulation({
    workflowId,
}: UseWorkflowSimulationOptions): UseWorkflowSimulationReturn {
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id ?? "";

    const [status, setStatus] = useState<SimStatus>("idle");
    const [events, setEvents] = useState<SimEvent[]>([]);
    const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
    const [stateVars, setStateVars] = useState<Record<string, unknown>>({});

    const wsRef = useRef<WebSocket | null>(null);

    const cleanup = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    const start = useCallback(async () => {
        cleanup();
        setEvents([]);
        setCurrentNodeId(null);
        setStateVars({});
        setStatus("connecting");

        const params = new URLSearchParams();
        if (workspaceId) params.set("workspace_id", workspaceId);

        const wsUrl = `${WS_BASE_URL}/ws/workflows/${encodeURIComponent(workflowId)}/simulate?${params.toString()}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setStatus("connecting");
        };

        ws.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data) as { type: string; payload?: unknown };

                switch (msg.type) {
                    case "waiting_trigger": {
                        setStatus("waiting_trigger");
                        break;
                    }
                    case "sim_started": {
                        setStatus("running");
                        break;
                    }
                    case "node_executed": {
                        const p = msg.payload as { nodeId: string; nodeType: string; output?: Record<string, unknown>; error?: string };
                        setCurrentNodeId(p.nodeId);
                        setEvents((prev) => [...prev, { type: "node_event", ...p }]);
                        break;
                    }
                    case "message_sent": {
                        const p = msg.payload as { direction: "outbound" | "inbound"; text: string; msgType: string; nodeId?: string; messageId: string; audioBase64?: string; audioMime?: string; audioUrl?: string };
                        setEvents((prev) => [...prev, { type: "message", ...p }]);
                        break;
                    }
                    case "waiting_reply": {
                        const p = msg.payload as { nodeId: string; timeoutSeconds: number };
                        setStatus("waiting_reply");
                        setCurrentNodeId(p.nodeId);
                        setEvents((prev) => [...prev, { type: "waiting_reply", ...p }]);
                        break;
                    }
                    case "waiting_key": {
                        const p = msg.payload as { timeoutSeconds: number };
                        setStatus("waiting_key");
                        setEvents((prev) => [...prev, { type: "waiting_key", timeoutSeconds: p.timeoutSeconds }]);
                        break;
                    }
                    case "call_transferred": {
                        const p = msg.payload as { queueId: string; queueName: string; notes?: string };
                        setEvents((prev) => [...prev, { type: "call_transferred", ...p }]);
                        break;
                    }
                    case "state_update": {
                        const p = msg.payload as { vars: Record<string, unknown> };
                        setStateVars(p.vars);
                        setEvents((prev) => [...prev, { type: "state", vars: p.vars }]);
                        break;
                    }
                    case "run_completed": {
                        setStatus("completed");
                        break;
                    }
                    case "run_cancelled": {
                        setStatus("cancelled");
                        break;
                    }
                    case "run_error": {
                        const p = msg.payload as { error?: string } | string;
                        const errMsg = typeof p === "string" ? p : (p as { error?: string })?.error ?? "Unknown error";
                        setStatus("error");
                        setEvents((prev) => [...prev, { type: "error", message: errMsg }]);
                        break;
                    }
                    case "error": {
                        const p = msg.payload as string;
                        setStatus("error");
                        setEvents((prev) => [...prev, { type: "error", message: p ?? "Unknown error" }]);
                        break;
                    }
                }
            } catch {
            }
        };

        ws.onclose = () => {
            setStatus((prev) => (LIVE_STATUSES.includes(prev) ? "error" : prev));
        };

        ws.onerror = () => {
            setStatus("error");
        };
    }, [cleanup, workflowId, workspaceId]);

    const sendReply = useCallback((text: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "reply", data: { text } }));
            setStatus((prev) => prev === "waiting_trigger" ? "running" : "running");
            setEvents((prev) => [
                ...prev,
                {
                    type: "message",
                    direction: "inbound" as const,
                    text,
                    msgType: "text",
                    messageId: `local-${Date.now()}`,
                },
            ]);
        }
    }, []);

    const sendKey = useCallback((key: string) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({ type: "key", data: { key } }));
        setStatus((prev) => (prev === "waiting_key" ? "running" : prev));
        setEvents((prev) => [
            ...prev,
            { type: "message", direction: "inbound" as const, text: key, msgType: "key", messageId: `key-${Date.now()}` },
        ]);
    }, []);

    const cancel = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "cancel" }));
        }
        cleanup();
        setStatus("cancelled");
    }, [cleanup]);

    return { status, events, currentNodeId, stateVars, start, sendReply, sendKey, cancel };
}
