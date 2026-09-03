import { apiClient } from '@/lib/api/browser-client';

export type PipelineObjectType = 'conversation' | 'opportunity';

// Mirrors domain/pipeline.Pipeline (workspace-global). ObjectType discriminates a
// conversation pipeline (the CRM board) from an opportunity/deal pipeline.
export interface Pipeline {
    id: string;
    workspaceId: string;
    name: string;
    objectType: PipelineObjectType;
    departmentId?: string;
    position: number;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

export function listPipelines(objectType: PipelineObjectType = 'conversation') {
    const qs = objectType ? `?objectType=${encodeURIComponent(objectType)}` : '';
    return apiClient<Pipeline[]>(`/pipelines${qs}`, { method: 'GET' });
}

/** One column of a new funnel, exactly as the operator drew it. */
export interface StageSeed {
    name: string;
    description?: string;
    color?: string;
}

export interface CreatePipelineInput {
    name: string;
    objectType?: PipelineObjectType;
    /**
     * The columns this funnel starts with, in board order. The first one receives
     * arriving conversations.
     *
     * This is the ordinary path: a funnel is a process someone designed, so the
     * composer sends the process. Templates below only PREFILL this list in the
     * client — whatever is sent here is what gets built.
     */
    stages?: StageSeed[];
    /**
     * Duplicate an existing funnel's columns instead. Ignored when `stages` is
     * present, and only reached by callers that have no composer (an integration
     * creating a funnel through the API).
     */
    copyStagesFromPipelineId?: string;
}

export function createPipeline(input: CreatePipelineInput) {
    const drawn = (input.stages ?? [])
        .map((s) => ({
            name: s.name.trim(),
            description: s.description?.trim() || undefined,
            color: s.color?.trim() || undefined,
        }))
        .filter((s) => s.name.length > 0);

    return apiClient<Pipeline>('/pipelines', {
        method: 'POST',
        body: JSON.stringify({
            name: input.name,
            objectType: input.objectType ?? 'conversation',
            ...(drawn.length > 0 ? { stages: drawn } : {}),
            ...(drawn.length === 0 && input.copyStagesFromPipelineId
                ? { copyStagesFromPipelineId: input.copyStagesFromPipelineId }
                : {}),
        }),
    });
}

export interface UpdatePipelineInput {
    name?: string;
    departmentId?: string;
    position?: number;
    isDefault?: boolean;
}

export function updatePipeline(id: string, input: UpdatePipelineInput) {
    return apiClient<Pipeline>(`/pipelines/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
    });
}

/**
 * What a funnel still holds, split by what the operator has to DO about it.
 *
 * Conversations are moved (the delete names a destination). Everything else is
 * unlinked at its own source, which is why the counts are not summed into one
 * "in use" number that would say "blocked" without saying where to go.
 */
export interface PipelineUsage {
    entries: number;
    campaigns: number;
    channels: number;
    opportunities: number;
}

export function getPipelineUsage(id: string) {
    return apiClient<PipelineUsage>(`/pipelines/${encodeURIComponent(id)}/usage`, {
        method: 'GET',
    });
}

/** Everything that must be unlinked elsewhere before the funnel can go. */
export function blockingBindings(usage: PipelineUsage): number {
    return usage.campaigns + usage.channels + usage.opportunities;
}

export type PipelineDeleteRefusal =
    | 'default'
    | 'bound'
    | 'needsDestination'
    | 'destinationInvalid';

/**
 * Which guard refused the delete.
 *
 * The domain spells its refusals in English, written for whoever is reading a
 * log, and the product runs in four languages — so the UI needs a key, not a
 * sentence. The stable half of each message is matched here, the same contract
 * the WhatsApp template error codes settled on.
 *
 * A sentinel this does not recognise returns undefined, and the caller falls
 * back to the server's own message. A new guard on the server therefore degrades
 * to English rather than to a blank dialog.
 */
export function refusalFromMessage(
    message: string,
): PipelineDeleteRefusal | undefined {
    const m = message.toLowerCase();
    if (m.includes('default funnel cannot be deleted')) return 'default';
    if (m.includes('still in use')) return 'bound';
    if (m.includes('name a destination funnel')) return 'needsDestination';
    if (m.includes('destination must be')) return 'destinationInvalid';
    return undefined;
}

/**
 * Delete a funnel, moving its conversations to `moveEntriesTo` first.
 *
 * The destination rides as a query parameter because DELETE bodies are unevenly
 * carried by proxies and fetch implementations, and this is one id.
 */
export function deletePipeline(id: string, moveEntriesTo?: string) {
    const qs = moveEntriesTo ? `?moveEntriesTo=${encodeURIComponent(moveEntriesTo)}` : '';
    return apiClient<null>(`/pipelines/${encodeURIComponent(id)}${qs}`, {
        method: 'DELETE',
    });
}
