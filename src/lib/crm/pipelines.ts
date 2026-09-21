import { apiClient } from '@/lib/api/browser-client';

export type PipelineObjectType = 'conversation' | 'opportunity';

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

export interface StageSeed {
    name: string;
    description?: string;
    color?: string;
}

export interface CreatePipelineInput {
    name: string;
    objectType?: PipelineObjectType;
    stages?: StageSeed[];
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

export function blockingBindings(usage: PipelineUsage): number {
    return usage.campaigns + usage.channels + usage.opportunities;
}

export type PipelineDeleteRefusal =
    | 'default'
    | 'bound'
    | 'needsDestination'
    | 'destinationInvalid';

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

export function deletePipeline(id: string, moveEntriesTo?: string) {
    const qs = moveEntriesTo ? `?moveEntriesTo=${encodeURIComponent(moveEntriesTo)}` : '';
    return apiClient<null>(`/pipelines/${encodeURIComponent(id)}${qs}`, {
        method: 'DELETE',
    });
}
