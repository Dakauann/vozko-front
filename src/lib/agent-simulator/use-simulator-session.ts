"use client";

import type {
    SessionMemory,
    SimulationHistoryMessage,
    TranscriptItem,
    TurnRecord,
} from "@/lib/agent-simulator/types";
import { useCallback, useEffect, useRef, useState } from "react";

import { foldSessionMemories } from "@/lib/agent-simulator/session-memories";
import { simulateAgentTurnAction } from "@/app/actions/agent-simulator";

export interface LeadContext {
    id: string;
    name: string;
}

export interface SimulatorSessionState {
    transcript: TranscriptItem[];
    turns: TurnRecord[];
    lead: LeadContext | null;
    sessionMemories: SessionMemory[];
}

const emptySession: SimulatorSessionState = {
    transcript: [],
    turns: [],
    lead: null,
    sessionMemories: [],
};

function sessionKey(agentId: string) {
    return `agent-simulator:${agentId}`;
}

function loadSession(agentId: string): SimulatorSessionState {
    if (typeof window === "undefined") return emptySession;
    try {
        const raw = window.sessionStorage.getItem(sessionKey(agentId));
        if (!raw) return emptySession;
        const parsed = JSON.parse(raw) as SimulatorSessionState;
        if (!Array.isArray(parsed.transcript) || !Array.isArray(parsed.turns)) return emptySession;
        return {
            ...parsed,
            lead: parsed.lead ?? null,
            sessionMemories: Array.isArray(parsed.sessionMemories) ? parsed.sessionMemories : [],
        };
    } catch {
        return emptySession;
    }
}

export function useSimulatorSession(agentId: string, options?: { genericErrorMessage?: string }) {
    const [session, setSession] = useState<SimulatorSessionState>(() => loadSession(agentId));
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [failedMessage, setFailedMessage] = useState<string | null>(null);

    const sessionRef = useRef(session);
    sessionRef.current = session;

    useEffect(() => {
        try {
            window.sessionStorage.setItem(sessionKey(agentId), JSON.stringify(session));
        } catch {
        }
    }, [agentId, session]);

    const send = useCallback(
        async (raw: string): Promise<boolean> => {
            const message = raw.trim();
            if (!message || pending) return false;

            const current = sessionRef.current;
            const turnNumber = current.turns.length + 1;
            const userItem: TranscriptItem = {
                kind: "user",
                id: `u-${turnNumber}-${current.transcript.length}`,
                content: message,
            };
            const history: SimulationHistoryMessage[] = current.transcript
                .filter((item): item is Extract<TranscriptItem, { kind: "user" | "agent" }> =>
                    item.kind === "user" || item.kind === "agent",
                )
                .map((item) => ({
                    role: item.kind === "user" ? ("user" as const) : ("assistant" as const),
                    content: item.content,
                }));

            setError(null);
            setFailedMessage(null);
            setPending(true);
            setSession((prev) => ({ ...prev, transcript: [...prev.transcript, userItem] }));

            const startedAt = performance.now();
            const { turn, error: turnError } = await simulateAgentTurnAction(agentId, {
                message,
                history,
                leadId: current.lead?.id,
                sessionMemories: current.sessionMemories,
            });
            const latencyMs = Math.round(performance.now() - startedAt);
            setPending(false);

            if (turnError || !turn) {
                setError(turnError ?? options?.genericErrorMessage ?? "simulation failed");
                setFailedMessage(message);
                return false;
            }

            const toolItems: TranscriptItem[] = turn.toolCalls.map((call, index) => ({
                kind: "tool",
                id: `t-${turnNumber}-${index}`,
                turn: turnNumber,
                call,
            }));
            const agentItems: TranscriptItem[] = turn.replies
                .filter((reply) => reply.trim() !== "")
                .map((reply, index) => ({
                    kind: "agent",
                    id: `a-${turnNumber}-${index}`,
                    content: reply,
                }));

            setSession((prev) => ({
                ...prev,
                transcript: [...prev.transcript, ...toolItems, ...agentItems],
                turns: [
                    ...prev.turns,
                    { turn: turnNumber, debug: turn.debug, toolCalls: turn.toolCalls, latencyMs },
                ],
                sessionMemories: foldSessionMemories(prev.sessionMemories, turn.toolCalls),
            }));
            return true;
        },
        [agentId, options?.genericErrorMessage, pending],
    );

    const retry = useCallback(() => {
        if (!failedMessage) return;
        const sliced: SimulatorSessionState = {
            ...sessionRef.current,
            transcript: sessionRef.current.transcript.slice(0, -1),
        };
        sessionRef.current = sliced;
        setSession(sliced);
        const message = failedMessage;
        setFailedMessage(null);
        setError(null);
        void send(message);
    }, [failedMessage, send]);

    const reset = useCallback(() => {
        setSession((prev) => ({ ...emptySession, lead: prev.lead }));
        setError(null);
        setFailedMessage(null);
        try {
            window.sessionStorage.removeItem(sessionKey(agentId));
        } catch {
        }
    }, [agentId]);

    const setLeadContext = useCallback((lead: LeadContext | null) => {
        setSession({ ...emptySession, lead });
        setError(null);
        setFailedMessage(null);
    }, []);

    return {
        session,
        pending,
        error,
        failedMessage,
        send,
        retry,
        reset,
        setLeadContext,
    };
}
