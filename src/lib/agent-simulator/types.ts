
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

export type TranscriptItem =
    | { kind: "user"; id: string; content: string }
    | { kind: "agent"; id: string; content: string }
    | { kind: "tool"; id: string; turn: number; call: SimulatedToolCall };

export interface TurnRecord {
    turn: number;
    debug: SimulationDebug;
    toolCalls: SimulatedToolCall[];
    latencyMs: number;
}

export interface SessionMemory {
    id: string;
    content: string;
    category: string;
}
