"use client";

import { useEffect } from "react";

export type AgentEditMode = "beginner" | "professional";

function storageKey(agentId: string) {
    return `agent-edit-mode:${agentId}`;
}

const CREATE_MODE_KEY = "agent-create-mode";

export function useRememberCreateMode(mode: AgentEditMode) {
    useEffect(() => {
        try {
            window.localStorage.setItem(CREATE_MODE_KEY, mode);
        } catch {
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

export function useRememberEditMode(agentId: string, mode: AgentEditMode) {
    useEffect(() => {
        try {
            window.localStorage.setItem(storageKey(agentId), mode);
        } catch {
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
