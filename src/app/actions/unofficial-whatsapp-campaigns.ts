/**
 * Server actions for unofficial WhatsApp campaigns.
 *
 * Same `apiClient` idiom as every other action file in the project, and
 * deliberately the same function shapes as `whatsapp-campaigns.ts`, so a
 * component parameterised over the two channels can call either without
 * branching on shape.
 */

import type {
    AddEntriesResult,
    QuickSendResult,
    UnofficialWhatsAppCampaign,
    UnofficialWhatsAppCampaignEntry,
    UnofficialWhatsAppCampaignListMeta,
    UnofficialWhatsAppCampaignPayload,
    UnofficialWhatsAppCampaignTarget,
    ValidateTargetsResult,
} from '@/lib/unofficial-whatsapp-campaigns/types';
import type { CampaignMetrics } from '@/lib/campaigns/metrics';

import { apiClient } from '@/lib/api/browser-client';
import { fetchCsvExport } from '@/app/actions/whatsapp-campaigns';

const BASE = '/unofficial-whatsapp/campaigns';

const DEFAULT_META: UnofficialWhatsAppCampaignListMeta = {
    page: 1,
    pageSize: 15,
    totalPages: 1,
    totalItems: 0,
};

interface ListApiResponse<T> {
    data: T[];
    meta: UnofficialWhatsAppCampaignListMeta;
}

/** A success envelope. The API wraps single objects in `data`. */
interface Envelope<T> {
    data?: T;
}

function unwrap<T>(payload?: Envelope<T> | T | null): T | undefined {
    if (payload && typeof payload === 'object' && 'data' in payload) {
        return (payload as Envelope<T>).data;
    }
    return (payload as T) ?? undefined;
}

// ---------------------------------------------------------------- reads

export async function listUnofficialCampaignsAction(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    instanceId?: string;
    archived?: boolean;
}) {
    const query = new URLSearchParams({
        page: String(params?.page ?? 1),
        pageSize: String(params?.pageSize ?? 15),
    });
    if (params?.search) query.set('search', params.search);
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.instanceId) query.set('instanceId', params.instanceId);
    if (params?.archived !== undefined) query.set('archived', String(params.archived));

    const path = params?.archived ? `${BASE}/archived?${query}` : `${BASE}?${query}`;
    const response = await apiClient<ListApiResponse<UnofficialWhatsAppCampaign>>(path, {
        method: 'GET',
    });
    if (response.error) {
        return {
            campaigns: [] as UnofficialWhatsAppCampaign[],
            meta: DEFAULT_META,
            error: response.error.message,
        };
    }
    return {
        campaigns: response.data?.data ?? [],
        meta: response.data?.meta ?? DEFAULT_META,
    };
}

export async function getUnofficialCampaignAction(campaignId: string) {
    const response = await apiClient<Envelope<UnofficialWhatsAppCampaign>>(
        `${BASE}/${campaignId}`,
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return { campaign: unwrap(response.data) };
}

export async function getUnofficialCampaignsSummaryAction(params?: {
    from?: string;
    to?: string;
    instanceId?: string;
}) {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.instanceId) query.set('instanceId', params.instanceId);

    const response = await apiClient<Envelope<CampaignMetrics>>(`${BASE}/summary?${query}`, {
        method: 'GET',
    });
    if (response.error) return { metrics: null, error: response.error.message };
    return { metrics: unwrap(response.data) ?? null };
}

export async function listUnofficialCampaignEntriesAction(
    campaignId: string,
    params?: { page?: number; pageSize?: number; status?: string; search?: string },
) {
    const query = new URLSearchParams({
        page: String(params?.page ?? 1),
        pageSize: String(params?.pageSize ?? 25),
    });
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.search) query.set('search', params.search);

    const response = await apiClient<ListApiResponse<UnofficialWhatsAppCampaignEntry>>(
        `${BASE}/${campaignId}/entries?${query}`,
        { method: 'GET' },
    );
    if (response.error) {
        return {
            entries: [] as UnofficialWhatsAppCampaignEntry[],
            meta: DEFAULT_META,
            error: response.error.message,
        };
    }
    return {
        entries: response.data?.data ?? [],
        meta: response.data?.meta ?? DEFAULT_META,
    };
}

// ---------------------------------------------------------------- writes

export async function createUnofficialCampaignAction(payload: UnofficialWhatsAppCampaignPayload) {
    const response = await apiClient<Envelope<UnofficialWhatsAppCampaign>>(BASE, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    if (response.error) return { error: response.error.message };
    return { campaign: unwrap(response.data) };
}

export async function updateUnofficialCampaignAction(
    campaignId: string,
    payload: UnofficialWhatsAppCampaignPayload,
) {
    const response = await apiClient<Envelope<UnofficialWhatsAppCampaign>>(`${BASE}/${campaignId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    if (response.error) return { error: response.error.message };
    return { campaign: unwrap(response.data) };
}

export async function deleteUnofficialCampaignAction(campaignId: string) {
    const response = await apiClient(`${BASE}/${campaignId}`, { method: 'DELETE' });
    if (response.error) return { error: response.error.message };
    return { deleted: true };
}

export async function assignUnofficialCampaignDepartmentAction(campaignId: string) {
    const response = await apiClient<Envelope<UnofficialWhatsAppCampaign>>(
        `${BASE}/${campaignId}/department`,
        { method: 'PATCH' },
    );
    if (response.error) return { error: response.error.message };
    return { campaign: unwrap(response.data) };
}

export async function archiveUnofficialCampaignAction(campaignId: string) {
    const response = await apiClient(`${BASE}/${campaignId}/archive`, { method: 'PATCH' });
    if (response.error) return { error: response.error.message };
    return { archived: true };
}

export async function unarchiveUnofficialCampaignAction(campaignId: string) {
    const response = await apiClient(`${BASE}/${campaignId}/unarchive`, { method: 'PATCH' });
    if (response.error) return { error: response.error.message };
    return { archived: false };
}

// ---------------------------------------------------------------- lifecycle

async function lifecycle(campaignId: string, action: 'start' | 'pause' | 'stop') {
    const response = await apiClient(`${BASE}/${campaignId}/${action}`, { method: 'POST' });
    if (response.error) return { error: response.error.message };
    return { ok: true };
}

export const startUnofficialCampaignAction = (id: string) => lifecycle(id, 'start');
export const pauseUnofficialCampaignAction = (id: string) => lifecycle(id, 'pause');
export const stopUnofficialCampaignAction = (id: string) => lifecycle(id, 'stop');

export async function quickSendUnofficialCampaignAction(
    campaignId: string,
    numbers?: UnofficialWhatsAppCampaignTarget[],
) {
    const response = await apiClient<Envelope<QuickSendResult>>(`${BASE}/${campaignId}/quick-send`, {
        method: 'POST',
        body: JSON.stringify({ numbers: numbers ?? [] }),
    });
    if (response.error) return { error: response.error.message };
    return { result: unwrap(response.data) };
}

/**
 * The optional pre-flight list clean.
 *
 * The send path checks every number anyway; this exists so an operator can see
 * how much of a purchased list is dead BEFORE committing to it.
 */
export async function validateUnofficialCampaignTargetsAction(campaignId: string) {
    const response = await apiClient<Envelope<ValidateTargetsResult>>(
        `${BASE}/${campaignId}/validate`,
        { method: 'POST' },
    );
    if (response.error) return { error: response.error.message };
    return { result: unwrap(response.data) };
}

// ---------------------------------------------------------------- entries

export async function addUnofficialCampaignEntriesAction(
    campaignId: string,
    numbers: UnofficialWhatsAppCampaignTarget[],
) {
    const response = await apiClient<Envelope<AddEntriesResult>>(`${BASE}/${campaignId}/entries`, {
        method: 'POST',
        body: JSON.stringify({ numbers }),
    });
    if (response.error) return { error: response.error.message };
    return { result: unwrap(response.data) };
}

export async function deleteUnofficialCampaignEntryAction(campaignId: string, entryId: string) {
    const response = await apiClient(`${BASE}/${campaignId}/entries/${entryId}`, {
        method: 'DELETE',
    });
    if (response.error) return { error: response.error.message };
    return { deleted: true };
}

// ---------------------------------------------------------------- reset / clear

export async function prepareResetUnofficialCampaignAction(campaignId: string) {
    const response = await apiClient<Envelope<{ resetCode: string; message: string }>>(
        `${BASE}/${campaignId}/reset/prepare`,
        { method: 'POST' },
    );
    if (response.error) return { error: response.error.message };
    return { data: unwrap(response.data) };
}

export async function confirmResetUnofficialCampaignAction(campaignId: string, resetCode: string) {
    const response = await apiClient<Envelope<{ resetCount: number }>>(`${BASE}/${campaignId}/reset`, {
        method: 'POST',
        body: JSON.stringify({ resetCode }),
    });
    if (response.error) return { error: response.error.message };
    return { data: unwrap(response.data) };
}

export async function prepareClearHistoryUnofficialCampaignAction(campaignId: string) {
    const response = await apiClient<Envelope<{ clearCode: string; messageCount: number }>>(
        `${BASE}/${campaignId}/clear-history/prepare`,
        { method: 'POST' },
    );
    if (response.error) return { error: response.error.message };
    return { data: unwrap(response.data) };
}

export async function confirmClearHistoryUnofficialCampaignAction(
    campaignId: string,
    clearCode: string,
) {
    const response = await apiClient<Envelope<{ deletedCount: number }>>(
        `${BASE}/${campaignId}/clear-history`,
        { method: 'POST', body: JSON.stringify({ clearCode }) },
    );
    if (response.error) return { error: response.error.message };
    return { data: unwrap(response.data) };
}

// ---------------------------------------------------------------- export

/**
 * Exports one campaign's recipients as CSV.
 *
 * Reuses the shared CSV fetcher rather than a second copy: it already carries
 * the download-error vocabulary the UI branches on — noEntries, tooLarge, busy —
 * and a second implementation would report a 413 as a generic failure.
 */
export async function exportUnofficialCampaignEntriesAction(
    campaignId: string,
    filters?: Record<string, string | string[] | undefined>,
) {
    return fetchCsvExport(`${BASE}/${campaignId}/entries/export`, filters);
}
