
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

export const LEAD_MEMORY_MAX_CONTENT_LENGTH = 600;

export type LeadMemoryActorKind = "human" | "ai" | "system";

export interface LeadMemory {
    id: string;
    leadId: string;
    category: LeadMemoryCategory;
    content: string;
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
