import type {
    SessionMemory,
    SimulateTurnResponse,
    SimulationHistoryMessage,
} from "@/lib/agent-simulator/types";

import { apiClient } from "@/lib/api/browser-client";

/**
 * Runs one sandboxed turn against the agent. The backend intercepts every
 * tool execution; the provider error text (when any) comes back verbatim:
 * "model deprecated" or "context too long" IS what the operator is here to see.
 */
export async function simulateAgentTurnAction(
    agentId: string,
    payload: {
        message: string;
        history: SimulationHistoryMessage[];
        leadId?: string;
        sessionMemories?: SessionMemory[];
    },
): Promise<{ turn: SimulateTurnResponse | null; error?: string }> {
    const response = await apiClient<SimulateTurnResponse>(`/agents/${agentId}/simulate`, {
        method: "POST",
        body: JSON.stringify({
            message: payload.message,
            history: payload.history,
            lead_id: payload.leadId || undefined,
            session_memories: payload.sessionMemories?.length
                ? payload.sessionMemories.map((m) => ({
                      id: m.id,
                      content: m.content,
                      category: m.category || undefined,
                  }))
                : undefined,
        }),
    });

    if (response.error) {
        return { turn: null, error: response.error.message };
    }
    return { turn: response.data ?? null };
}
