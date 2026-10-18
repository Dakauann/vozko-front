"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type AgentEditMode = "beginner" | "professional";

export type AgentModeLead = { mode: AgentEditMode; remembered: boolean };

const ignoreChanges = () => () => {};
const unknownOnServer = () => undefined;

function useStoredMode(read: () => AgentEditMode | null): AgentEditMode | null | undefined {
    return useSyncExternalStore(ignoreChanges, read, unknownOnServer);
}

function leadFrom(stored: AgentEditMode | null | undefined, fallback: AgentEditMode): AgentModeLead | null {
    if (stored === undefined) return null;
    return stored ? { mode: stored, remembered: true } : { mode: fallback, remembered: false };
}

export function useCreateModeLead(): AgentModeLead | null {
    return leadFrom(useStoredMode(recallCreateMode), "beginner");
}

export function useEditModeLead(agent: Parameters<typeof inferEditMode>[0] & { id: string }): AgentModeLead | null {
    const read = useCallback(() => recallEditMode(agent.id), [agent.id]);
    return leadFrom(useStoredMode(read), inferEditMode(agent));
}

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
