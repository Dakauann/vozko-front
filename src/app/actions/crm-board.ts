import { apiClient } from "@/lib/api/browser-client";
import {
    encodeBase64,
    emptyCrmFilter,
    type CrmBoard,
    type CrmBulkInput,
    type CrmBulkResult,
    type CrmEntriesResult,
    type FetchCrmBoardParams,
    type FetchCrmEntriesParams,
} from '@/lib/crm/board';
import { createPipeline, listPipelines, type CreatePipelineInput, type Pipeline, type PipelineObjectType } from '@/lib/crm/pipelines';

function fetchCrmBoard(params: FetchCrmBoardParams) {
    const qs = new URLSearchParams();
    qs.set('groupBy', params.groupBy);
    if (params.pipelineId) qs.set('pipelineId', params.pipelineId);
    qs.set('filter', encodeBase64(JSON.stringify(params.filter ?? emptyCrmFilter)));
    if (params.owners && params.owners.length > 0) {
        qs.set('owners', JSON.stringify(params.owners));
    }
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params.sortField) qs.set('sortField', params.sortField);
    if (params.sortOrder) qs.set('sortOrder', params.sortOrder);
    return apiClient<CrmBoard>(`/crm/board?${qs.toString()}`, { method: 'GET' });
}


export async function getCrmBoardAction(
    params: FetchCrmBoardParams,
): Promise<{ board: CrmBoard | null; error?: string }> {
    const response = await fetchCrmBoard(params);

    if (response.error) {
        return { board: null, error: response.error.message };
    }

    return { board: response.data ?? null };
}

function fetchCrmEntries(params: FetchCrmEntriesParams) {
    const qs = new URLSearchParams();
    qs.set('filter', encodeBase64(JSON.stringify(params.filter ?? emptyCrmFilter)));
    if (params.sortField) qs.set('sortField', params.sortField);
    if (params.sortOrder) qs.set('sortOrder', params.sortOrder);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return apiClient<CrmEntriesResult>(`/crm/entries?${qs.toString()}`, {
        method: 'GET',
    });
}

export async function getCrmEntriesAction(
    params: FetchCrmEntriesParams,
): Promise<{ result: CrmEntriesResult | null; error?: string }> {
    const response = await fetchCrmEntries(params);

    if (response.error) {
        return { result: null, error: response.error.message };
    }

    return { result: response.data ?? null };
}

function fetchCrmBulk(input: CrmBulkInput) {
    return apiClient<CrmBulkResult>('/crm/bulk', {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

export async function crmBulkAction(
    input: CrmBulkInput,
): Promise<{ result: CrmBulkResult | null; error?: string }> {
    const response = await fetchCrmBulk(input);

    if (response.error) {
        return { result: null, error: response.error.message };
    }

    return { result: response.data ?? null };
}

export async function listPipelinesAction(
    objectType: PipelineObjectType = 'conversation',
): Promise<{ pipelines: Pipeline[]; error?: string }> {
    const response = await listPipelines(objectType);

    if (response.error) {
        return { pipelines: [], error: response.error.message };
    }

    return { pipelines: response.data ?? [] };
}

export async function createPipelineAction(
    input: CreatePipelineInput,
): Promise<{ pipeline: Pipeline | null; error?: string }> {
    const response = await createPipeline(input);

    if (response.error) {
        return { pipeline: null, error: response.error.message };
    }

    return { pipeline: response.data ?? null };
}
