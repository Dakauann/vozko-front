import { apiClient } from "@/lib/api/browser-client";
import { encodeBase64, emptyCrmFilter } from '@/lib/crm/board';
import type {
    CreateOpportunityInput,
    FetchOpportunityBoardParams,
    FetchOpportunityListParams,
    MoveOpportunityInput,
    Opportunity,
    OpportunityBoard,
    OpportunityConversationLink,
    OpportunityListResult,
    UpdateOpportunityInput,
} from '@/lib/crm/opportunities';

function combinedSort(sortField?: string, sortOrder?: string): string {
    if (!sortField) return '';
    return sortOrder ? `${sortField}:${sortOrder}` : sortField;
}

function fetchBoard(params: FetchOpportunityBoardParams) {
    const qs = new URLSearchParams();
    qs.set('groupBy', params.groupBy);
    if (params.pipelineId) qs.set('pipelineId', params.pipelineId);
    if (params.groupByKey) qs.set('groupByKey', params.groupByKey);
    qs.set('filter', encodeBase64(JSON.stringify(params.filter ?? emptyCrmFilter)));
    if (params.owners && params.owners.length > 0) {
        qs.set('owners', encodeBase64(JSON.stringify(params.owners)));
    }
    if (params.options && params.options.length > 0) {
        qs.set('options', encodeBase64(JSON.stringify(params.options)));
    }
    if (params.sortField) qs.set('sortField', params.sortField);
    if (params.sortOrder) qs.set('sortOrder', params.sortOrder);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return apiClient<OpportunityBoard>(`/opportunities/board?${qs.toString()}`, {
        method: 'GET',
    });
}

export async function getOpportunityBoardAction(
    params: FetchOpportunityBoardParams,
): Promise<{ board: OpportunityBoard | null; error?: string }> {
    const response = await fetchBoard(params);
    if (response.error) return { board: null, error: response.error.message };
    return { board: response.data ?? null };
}

export async function getOpportunityListAction(
    params: FetchOpportunityListParams,
): Promise<{ result: OpportunityListResult | null; error?: string }> {
    const qs = new URLSearchParams();
    qs.set('filter', encodeBase64(JSON.stringify(params.filter ?? emptyCrmFilter)));
    const sort = combinedSort(params.sortField, params.sortOrder);
    if (sort) qs.set('sort', sort);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    const response = await apiClient<OpportunityListResult>(`/opportunities/list?${qs.toString()}`, {
        method: 'GET',
    });
    if (response.error) return { result: null, error: response.error.message };
    return { result: response.data ?? null };
}

export async function createOpportunityAction(
    input: CreateOpportunityInput,
): Promise<{ opportunity: Opportunity | null; error?: string }> {
    const response = await apiClient<Opportunity>('/opportunities', {
        method: 'POST',
        body: JSON.stringify(input),
    });
    if (response.error) return { opportunity: null, error: response.error.message };
    return { opportunity: response.data ?? null };
}

export async function updateOpportunityAction(
    id: string,
    input: UpdateOpportunityInput,
): Promise<{ opportunity: Opportunity | null; error?: string }> {
    const response = await apiClient<Opportunity>(`/opportunities/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
    });
    if (response.error) return { opportunity: null, error: response.error.message };
    return { opportunity: response.data ?? null };
}

export async function moveOpportunityAction(
    id: string,
    input: MoveOpportunityInput,
): Promise<{ opportunity: Opportunity | null; error?: string }> {
    const response = await apiClient<Opportunity>(`/opportunities/${id}/move`, {
        method: 'POST',
        body: JSON.stringify(input),
    });
    if (response.error) return { opportunity: null, error: response.error.message };
    return { opportunity: response.data ?? null };
}

export async function deleteOpportunityAction(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const response = await apiClient<void>(`/opportunities/${id}`, { method: 'DELETE' });
    if (response.error) return { success: false, error: response.error.message };
    return { success: true };
}

export async function getOpportunityAction(
    id: string,
): Promise<{ opportunity: Opportunity | null; error?: string }> {
    const response = await apiClient<Opportunity>(`/opportunities/${id}`, { method: 'GET' });
    if (response.error) return { opportunity: null, error: response.error.message };
    return { opportunity: response.data ?? null };
}

export async function listOpportunityConversationsAction(
    id: string,
): Promise<{ links: OpportunityConversationLink[]; error?: string }> {
    const response = await apiClient<OpportunityConversationLink[]>(`/opportunities/${id}/conversations`, {
        method: 'GET',
    });
    if (response.error) return { links: [], error: response.error.message };
    return { links: response.data ?? [] };
}

// Reverse of listOpportunityConversationsAction: the deals linked to a conversation
// entry, hydrated, so the conversation side panel can show them (HubSpot-style
// "associated deals"). Workspace-scoped server-side.
export async function listOpportunitiesForEntryAction(
    entryId: string,
    entryType: string,
): Promise<{ opportunities: Opportunity[]; error?: string }> {
    const qs = new URLSearchParams({ entryId, entryType }).toString();
    const response = await apiClient<Opportunity[]>(`/opportunities/for-entry?${qs}`, {
        method: 'GET',
    });
    if (response.error) return { opportunities: [], error: response.error.message };
    return { opportunities: response.data ?? [] };
}

export async function linkOpportunityConversationAction(
    id: string,
    entryId: string,
    entryType: string,
): Promise<{ success: boolean; error?: string }> {
    const response = await apiClient<unknown>(`/opportunities/${id}/conversations`, {
        method: 'POST',
        body: JSON.stringify({ entryId, entryType }),
    });
    if (response.error) return { success: false, error: response.error.message };
    return { success: true };
}

export async function unlinkOpportunityConversationAction(
    id: string,
    entryId: string,
    entryType: string,
): Promise<{ success: boolean; error?: string }> {
    const qs = new URLSearchParams({ entryId, entryType });
    const response = await apiClient<unknown>(`/opportunities/${id}/conversations?${qs.toString()}`, {
        method: 'DELETE',
    });
    if (response.error) return { success: false, error: response.error.message };
    return { success: true };
}
