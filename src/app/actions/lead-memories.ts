import type {
    LeadMemory,
    LeadMemoryCategory,
    LeadMemoryError,
    LeadMemoryErrorCode,
} from "@/lib/lead-memories/types";

import { apiClient } from "@/lib/api/browser-client";

interface LeadMemoryEnvelope {
    memory: LeadMemory;
}

interface LeadMemoryListEnvelope {
    memories: LeadMemory[];
    total: number;
}

function toLeadMemoryError(error: { message: string; code?: string }): LeadMemoryError {
    return { message: error.message, code: error.code as LeadMemoryErrorCode | undefined };
}

export async function listLeadMemoriesAction(
    leadId: string,
    category?: LeadMemoryCategory,
): Promise<{ memories: LeadMemory[]; total: number; error?: string }> {
    const query = category ? `?category=${category}` : "";
    const response = await apiClient<LeadMemoryListEnvelope>(
        `/leads/${leadId}/memories${query}`,
        { method: "GET" },
    );

    if (response.error) {
        return { memories: [], total: 0, error: response.error.message };
    }
    return {
        memories: response.data?.memories ?? [],
        total: response.data?.total ?? 0,
    };
}

/**
 * Creates a memory. The backend deduplicates equivalent content (same fact,
 * different casing/spacing) and answers with the existing memory instead of a
 * duplicate, so a double submit is safe.
 */
export async function createLeadMemoryAction(
    leadId: string,
    payload: { content: string; category: LeadMemoryCategory },
): Promise<{ memory: LeadMemory | null; error?: LeadMemoryError }> {
    const response = await apiClient<LeadMemoryEnvelope>(`/leads/${leadId}/memories`, {
        method: "POST",
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { memory: null, error: toLeadMemoryError(response.error) };
    }
    return { memory: response.data?.memory ?? null };
}

export async function updateLeadMemoryAction(
    id: string,
    patch: { content?: string; category?: LeadMemoryCategory },
): Promise<{ memory: LeadMemory | null; error?: LeadMemoryError }> {
    const response = await apiClient<LeadMemoryEnvelope>(`/lead-memories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });

    if (response.error) {
        return { memory: null, error: toLeadMemoryError(response.error) };
    }
    return { memory: response.data?.memory ?? null };
}

export async function deleteLeadMemoryAction(
    id: string,
): Promise<{ error?: LeadMemoryError }> {
    const response = await apiClient<void>(`/lead-memories/${id}`, { method: "DELETE" });

    if (response.error) {
        return { error: toLeadMemoryError(response.error) };
    }
    return {};
}
