"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useWorkspace } from "@/contexts/workspace-context";
import { startDecision, unconfirmedRealCalls, withConfirmedRealCalls } from "@/lib/workflows/real-calls";
import { customerReplyCommand, type SimCustomerReply } from "@/lib/workflows/sim-replies";
import {
    applySimIntent,
    applySimMessage,
    connectingSimSession,
    initialSimSession,
    simCommand,
    simulationUrl,
    type SimIntent,
    type SimServerMessage,
    type SimSession,
} from "@/lib/workflows/sim-session";
import type { SimTriggerStart } from "@/lib/workflows/trigger-input";

export type { SimEvent, SimStatus, SimStep } from "@/lib/workflows/sim-session";

const WS_BASE_URL =
    process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";

export interface SimStartOptions {
    reproduceRunId?: string;
    runUntil?: string;
    trigger?: SimTriggerStart;
}

type Schedule = (flush: () => void) => void;

const frameSchedule: Schedule = (flush) => {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => flush());
        return;
    }
    queueMicrotask(flush);
};

interface UseWorkflowSimulationOptions {
    workflowId: string;
    schedule?: Schedule;
}

export interface UseWorkflowSimulationReturn extends SimSession {
    pendingRealCalls: string[];
    connect: () => void;
    start: (options?: SimStartOptions) => void;
    sendReply: (reply: SimCustomerReply) => void;
    sendKey: (key: string) => void;
    cancel: () => void;
    step: () => void;
    resume: () => void;
    runUntil: (nodeId: string) => void;
    setBreakpoints: (nodeIds: string[]) => void;
    confirmRealCalls: () => void;
    skipRealCalls: () => void;
    dismissRealCalls: () => void;
    retryWithRealCalls: (nodeId: string) => void;
    reset: () => void;
}

type Update = (session: SimSession) => SimSession;

export function useWorkflowSimulation({
    workflowId,
    schedule = frameSchedule,
}: UseWorkflowSimulationOptions): UseWorkflowSimulationReturn {
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.id ?? "";

    const [session, setSession] = useState<SimSession>(initialSimSession);
    const [pendingRealCalls, setPendingRealCalls] = useState<string[]>([]);

    const wsRef = useRef<WebSocket | null>(null);
    const queueRef = useRef<Update[]>([]);
    const flushScheduledRef = useRef(false);
    const breakpointsRef = useRef<string[]>([]);
    const confirmedRef = useRef<ReadonlySet<string>>(new Set());
    const pendingStartRef = useRef<SimStartOptions | null>(null);
    const lastStartRef = useRef<SimStartOptions>({});
    const lastTriggerRef = useRef<SimTriggerStart | null>(null);
    const readyRealCallsRef = useRef<string[]>([]);
    const readyRef = useRef(false);
    const firstReplyRef = useRef<SimCustomerReply | null>(null);
    const replayRef = useRef<SimCustomerReply | null>(null);

    const flush = useCallback(() => {
        flushScheduledRef.current = false;
        const updates = queueRef.current;
        if (updates.length === 0) return;
        queueRef.current = [];
        setSession((current) => updates.reduce((next, update) => update(next), current));
    }, []);

    const enqueue = useCallback(
        (update: Update) => {
            queueRef.current.push(update);
            if (flushScheduledRef.current) return;
            flushScheduledRef.current = true;
            schedule(flush);
        },
        [schedule, flush],
    );

    const applyNow = useCallback(
        (intent: SimIntent) => {
            queueRef.current.push((current) => applySimIntent(current, intent));
            flush();
        },
        [flush],
    );

    const send = useCallback((type: string, data?: Record<string, unknown>) => {
        const ws = wsRef.current;
        if (ws?.readyState !== WebSocket.OPEN) return false;
        ws.send(simCommand(type, data));
        return true;
    }, []);

    const closeSocket = useCallback(() => {
        const ws = wsRef.current;
        wsRef.current = null;
        readyRef.current = false;
        if (ws) ws.close();
    }, []);

    useEffect(() => closeSocket, [closeSocket]);

    const deliverReply = useCallback(
        (reply: SimCustomerReply) => {
            const command = customerReplyCommand(reply);
            if (!send(command.type, command.data)) return false;
            applyNow({ kind: "replied" });
            return true;
        },
        [send, applyNow],
    );

    const replayFirstReply = useCallback(() => {
        const reply = replayRef.current;
        replayRef.current = null;
        if (!reply) return;
        flush();
        deliverReply(reply);
    }, [flush, deliverReply]);

    const launch = useCallback(
        (options: SimStartOptions, confirm: boolean) => {
            pendingStartRef.current = null;
            setPendingRealCalls([]);
            if (confirm) send("confirm_real_calls");
            if (options.runUntil) send("run_until", { nodeId: options.runUntil });
            if (options.reproduceRunId) send("reproduce_run", { runId: options.reproduceRunId });
            else if (options.trigger) send("start", { ...options.trigger });
            else send("start");
            applyNow({ kind: "start_sent", reproduceRunId: options.reproduceRunId });
        },
        [send, applyNow],
    );

    const proceed = useCallback(
        (requested: SimStartOptions) => {
            const trigger = requested.trigger ?? (requested.reproduceRunId ? undefined : lastTriggerRef.current ?? undefined);
            const options = trigger ? { ...requested, trigger } : requested;
            if (options.trigger) lastTriggerRef.current = options.trigger;
            lastStartRef.current = options;
            const realCallNodes = readyRealCallsRef.current;
            const decision = startDecision({
                realCallNodes,
                confirmed: confirmedRef.current,
                reproducing: Boolean(options.reproduceRunId),
            });
            if (decision === "ask") {
                pendingStartRef.current = options;
                setPendingRealCalls(unconfirmedRealCalls(realCallNodes, confirmedRef.current));
                applyNow({ kind: "confirming" });
                return;
            }
            launch(options, decision === "confirm");
        },
        [applyNow, launch],
    );

    const open = useCallback(
        (options: SimStartOptions | null) => {
            closeSocket();
            queueRef.current = [];
            pendingStartRef.current = options;
            replayRef.current = null;
            setPendingRealCalls([]);
            setSession(connectingSimSession());

            const ws = new WebSocket(simulationUrl(WS_BASE_URL, workflowId, workspaceId));
            wsRef.current = ws;

            ws.onmessage = (evt) => {
                if (wsRef.current !== ws) return;
                let message: SimServerMessage;
                try {
                    message = JSON.parse(evt.data) as SimServerMessage;
                } catch {
                    return;
                }
                enqueue((current) => applySimMessage(current, message));
                if (message.type === "waiting_trigger") {
                    replayFirstReply();
                    return;
                }
                if (message.type !== "sim_ready") return;
                const payload = (message.payload ?? {}) as { realCallNodes?: unknown };
                readyRealCallsRef.current = Array.isArray(payload.realCallNodes)
                    ? payload.realCallNodes.filter((id): id is string => typeof id === "string")
                    : [];
                readyRef.current = true;
                send("set_breakpoints", { nodeIds: breakpointsRef.current });
                const pending = pendingStartRef.current;
                if (!pending) return;
                flush();
                proceed(pending);
            };

            ws.onclose = () => {
                if (wsRef.current !== ws) return;
                wsRef.current = null;
                readyRef.current = false;
                enqueue((current) => applySimIntent(current, { kind: "closed" }));
            };

            ws.onerror = () => {
                if (wsRef.current !== ws) return;
                enqueue((current) => applySimIntent(current, { kind: "failed" }));
            };
        },
        [closeSocket, enqueue, flush, proceed, replayFirstReply, send, workflowId, workspaceId],
    );

    const connect = useCallback(() => open(null), [open]);

    const start = useCallback(
        (options: SimStartOptions = {}) => {
            if (readyRef.current && session.status === "ready") {
                const refusedRunUntil = session.refusal?.command === "start" ? lastStartRef.current.runUntil : undefined;
                proceed(refusedRunUntil && !options.runUntil ? { ...options, runUntil: refusedRunUntil } : options);
                return;
            }
            open(options);
        },
        [open, proceed, session.status, session.refusal],
    );

    const sendReply = useCallback(
        (reply: SimCustomerReply) => {
            if (!deliverReply(reply)) return;
            if (session.status === "waiting_trigger") firstReplyRef.current = reply;
        },
        [deliverReply, session.status],
    );

    const sendKey = useCallback(
        (key: string) => {
            if (!send("key", { key })) return;
            applyNow({ kind: "key", key, messageId: `key-${Date.now()}` });
        },
        [send, applyNow],
    );

    const cancel = useCallback(() => {
        send("cancel");
        closeSocket();
        pendingStartRef.current = null;
        replayRef.current = null;
        setPendingRealCalls([]);
        applyNow({ kind: "cancelled" });
    }, [send, closeSocket, applyNow]);

    const step = useCallback(() => {
        if (send("step")) applyNow({ kind: "resumed" });
    }, [send, applyNow]);

    const resume = useCallback(() => {
        if (send("continue")) applyNow({ kind: "resumed" });
    }, [send, applyNow]);

    const runUntil = useCallback(
        (nodeId: string) => {
            const started = readyRef.current && session.status !== "ready" && session.status !== "confirming";
            if (started && send("run_until", { nodeId })) {
                applyNow({ kind: "resumed" });
                return;
            }
            start({ runUntil: nodeId });
        },
        [send, applyNow, start, session.status],
    );

    const setBreakpoints = useCallback(
        (nodeIds: string[]) => {
            breakpointsRef.current = nodeIds;
            if (readyRef.current) send("set_breakpoints", { nodeIds });
        },
        [send],
    );

    const confirmRealCalls = useCallback(() => {
        const pending = pendingStartRef.current;
        if (!pending) return;
        confirmedRef.current = withConfirmedRealCalls(confirmedRef.current, readyRealCallsRef.current);
        launch(pending, true);
    }, [launch]);

    const skipRealCalls = useCallback(() => {
        const pending = pendingStartRef.current;
        if (!pending) return;
        launch(pending, false);
    }, [launch]);

    const dismissRealCalls = useCallback(() => {
        pendingStartRef.current = null;
        replayRef.current = null;
        setPendingRealCalls([]);
        applyNow({ kind: "dismissed" });
    }, [applyNow]);

    const retryWithRealCalls = useCallback(
        (nodeId: string) => {
            confirmedRef.current = withConfirmedRealCalls(confirmedRef.current, [...readyRealCallsRef.current, nodeId]);
            open(lastStartRef.current);
            replayRef.current = firstReplyRef.current;
        },
        [open],
    );

    const reset = useCallback(() => {
        send("cancel");
        closeSocket();
        queueRef.current = [];
        pendingStartRef.current = null;
        confirmedRef.current = new Set();
        readyRealCallsRef.current = [];
        lastTriggerRef.current = null;
        lastStartRef.current = {};
        firstReplyRef.current = null;
        replayRef.current = null;
        setPendingRealCalls([]);
        setSession(initialSimSession());
    }, [send, closeSocket]);

    return useMemo(
        () => ({
            ...session,
            pendingRealCalls,
            connect,
            start,
            sendReply,
            sendKey,
            cancel,
            step,
            resume,
            runUntil,
            setBreakpoints,
            confirmRealCalls,
            skipRealCalls,
            dismissRealCalls,
            retryWithRealCalls,
            reset,
        }),
        [
            session,
            pendingRealCalls,
            connect,
            start,
            sendReply,
            sendKey,
            cancel,
            step,
            resume,
            runUntil,
            setBreakpoints,
            confirmRealCalls,
            skipRealCalls,
            dismissRealCalls,
            retryWithRealCalls,
            reset,
        ],
    );
}
