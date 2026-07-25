import type {
    CreateMessageShortcutPayload,
    MessageShortcut,
    UpdateMessageShortcutPayload,
} from "@/lib/message-shortcuts/types";

import { apiClient } from "@/lib/api/browser-client";

export async function listMessageShortcutsAction() {
    const response = await apiClient<MessageShortcut[]>("/message-shortcuts", {
        method: "GET",
    });

    if (response.error) {
        return { shortcuts: [] as MessageShortcut[], error: response.error.message };
    }

    return { shortcuts: response.data ?? [] };
}

export async function createMessageShortcutAction(payload: CreateMessageShortcutPayload) {
    const response = await apiClient<MessageShortcut>("/message-shortcuts", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { shortcut: null, error: response.error.message };
    }

    return { shortcut: response.data ?? null };
}

export async function updateMessageShortcutAction(id: string, payload: UpdateMessageShortcutPayload) {
    const response = await apiClient<MessageShortcut>(`/message-shortcuts/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { shortcut: null, error: response.error.message };
    }

    return { shortcut: response.data ?? null };
}

export async function deleteMessageShortcutAction(id: string) {
    const response = await apiClient<void>(`/message-shortcuts/${id}`, {
        method: "DELETE",
    });

    if (response.error) {
        return { error: response.error.message };
    }

    return {};
}
