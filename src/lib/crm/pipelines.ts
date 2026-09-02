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

export interface CreatePipelineInput {
    name: string;
    objectType?: PipelineObjectType;
    /**
     * Duplicate an existing funnel's stages into the new one. Omitted, the server
     * seeds the product's default stages — either way the funnel arrives with
     * columns, because an empty one renders a board nobody can add to.
     */
    copyStagesFromPipelineId?: string;
}

export function createPipeline(input: CreatePipelineInput) {
    return apiClient<Pipeline>('/pipelines', {
        method: 'POST',
        body: JSON.stringify({
            name: input.name,
            objectType: input.objectType ?? 'conversation',
            ...(input.copyStagesFromPipelineId
                ? { copyStagesFromPipelineId: input.copyStagesFromPipelineId }
                : {}),
        }),
    });
}
