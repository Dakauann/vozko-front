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
