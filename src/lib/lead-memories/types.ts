/**
 * Lead memories: facts about a lead written by AI agents (via the
 * manage_lead_memory tool) and by operators, injected into every agent
 * conversation with that lead. Mirrors vozko-back/delivery/http/leadmemory.
 */

export const LEAD_MEMORY_CATEGORIES = [
    "personal",
    "preference",
    "deal",
    "objection",
    "commitment",
    "event",
    "other",
] as const;

export type LeadMemoryCategory = (typeof LEAD_MEMORY_CATEGORIES)[number];

/** Matches domain/lead_memory.MaxContentLen; the form enforces it client-side. */
export const LEAD_MEMORY_MAX_CONTENT_LENGTH = 600;

export type LeadMemoryActorKind = "human" | "ai" | "system";

export interface LeadMemory {
    id: string;
    leadId: string;
    category: LeadMemoryCategory;
    content: string;
    /**
     * Who wrote the current version. actorLabel is the resolved display name
     * (best-effort); when empty, render the kind ("IA" / "Operador(a)").
     */
    actorKind: LeadMemoryActorKind;
    actorId: string;
    actorLabel?: string;
    sourceEntryId?: string;
    sourceEntryType?: string;
    createdAt: string;
    updatedAt: string;
}

export type LeadMemoryErrorCode =
    | "not_found"
    | "memory_duplicate"
    | "memory_limit"
    | "ambiguous_id"
    | "invalid_request"
    | "invalid_category";

export interface LeadMemoryError {
    message: string;
    code?: LeadMemoryErrorCode;
}
