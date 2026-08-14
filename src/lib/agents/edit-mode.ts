"use client";

import { useEffect } from "react";

export type AgentEditMode = "beginner" | "professional";

function storageKey(agentId: string) {
    return `agent-edit-mode:${agentId}`;
}

/**
 * Remembers which editor an operator last used for an agent, so the chooser
 * can lead with it next time. Recognition over recall: an agent edited in the
 * professional form last week should present that door first today.
 */
export function useRememberEditMode(agentId: string, mode: AgentEditMode) {
    useEffect(() => {
        try {
            window.localStorage.setItem(storageKey(agentId), mode);
        } catch {
            // Storage unavailable: the chooser simply shows no "last used" hint.
        }
    }, [agentId, mode]);
}

export function recallEditMode(agentId: string): AgentEditMode | null {
    if (typeof window === "undefined") return null;
    try {
        const value = window.localStorage.getItem(storageKey(agentId));
        return value === "beginner" || value === "professional" ? value : null;
    } catch {
        return null;
    }
}

/**
 * When nothing is remembered, the agent's own configuration answers the
 * question: anything beyond the guided editor's field set (tools, RAG,
 * template binding) means the complete editor built it.
 */
export function inferEditMode(agent: {
    internalTools?: unknown[] | null;
    ragEnabled?: boolean;
    whatsappTemplateId?: string | null;
}): AgentEditMode {
    const usesAdvancedConfig =
        (agent.internalTools?.length ?? 0) > 0 ||
        agent.ragEnabled === true ||
        Boolean(agent.whatsappTemplateId);
    return usesAdvancedConfig ? "professional" : "beginner";
}
