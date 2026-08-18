/**
 * Agent simulator: an operator plays the lead against a real agent in a
 * sandbox. Mirrors vozko-back/delivery/http/handlers/agent_simulate_handler.go.
 *
 * Read-only tools run for real server-side, so a knowledge-base search really
 * searches; anything that could change something is intercepted. Per call,
 * `stubbed` says which happened.
 */

export type SimulationRole = "user" | "assistant";

export interface SimulationHistoryMessage {
    role: SimulationRole;
    content: string;
}

export interface SimulatedToolCall {
    name: string;
    arguments: Record<string, unknown>;
    result?: string;
    isError: boolean;
    /**
     * false when the real tool ran and `result` is genuine; true when it was
     * intercepted and `result` is canned. Without the distinction "the base
     * returned nothing" and "the search never happened" look identical.
     */
    stubbed: boolean;
}

export interface SimulationDebug {
    model: string;
    systemPrompt: string;
    toolNames: string[];
    memoryInjected: boolean;
    ragInjected: boolean;
    promptTokens: number;
    completionTokens: number;
    finishReason?: string;
}

export interface SimulateTurnResponse {
    replies: string[];
    toolCalls: SimulatedToolCall[];
    debug: SimulationDebug;
}

/** One entry of the transcript the page renders. Tool events sit between
 * bubbles at the position they fired: conversational truth, not an appendix. */
export type TranscriptItem =
    | { kind: "user"; id: string; content: string }
    | { kind: "agent"; id: string; content: string }
    | { kind: "tool"; id: string; turn: number; call: SimulatedToolCall };

/** Per-turn X-ray kept alongside the transcript for the inspector rail. */
export interface TurnRecord {
    turn: number;
    debug: SimulationDebug;
    toolCalls: SimulatedToolCall[];
    latencyMs: number;
}

/**
 * A fact "remembered" during this simulated session. The sandbox intercepts
 * the write, so the client holds it and replays it on every turn; the backend
 * injects it like a real memory.
 */
export interface SessionMemory {
    id: string;
    content: string;
    category: string;
}
