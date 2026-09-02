"use client";

import { useEffect } from "react";

export type AgentEditMode = "beginner" | "professional";

function storageKey(agentId: string) {
    return `agent-edit-mode:${agentId}`;
}

/**
 * The create chooser remembers per WORKSPACE OPERATOR, not per agent — there is
 * no agent yet to key on, and the question it answers is different: not "how was
 * this agent built" but "how do you build agents". Someone who reaches for the
 * complete form should not be handed the guided wizard first every time.
 */
const CREATE_MODE_KEY = "agent-create-mode";

export function useRememberCreateMode(mode: AgentEditMode) {
    useEffect(() => {
        try {
            window.localStorage.setItem(CREATE_MODE_KEY, mode);
        } catch {
            // Storage unavailable: the chooser simply leads with the default.
        }
    }, [mode]);
}

export function recallCreateMode(): AgentEditMode | null {
    if (typeof window === "undefined") return null;
    try {
        const value = window.localStorage.getItem(CREATE_MODE_KEY);
        return value === "beginner" || value === "professional" ? value : null;
    } catch {
        return null;
    }
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
