import type {
    WhatsAppCampaign,
    WhatsAppCampaignClearHistoryConfirmResponse,
    WhatsAppCampaignClearHistoryPrepareResponse,
    WhatsAppCampaignEntriesApiResponse,
    WhatsAppCampaignEntriesListParams,
    WhatsAppCampaignEntryWithLead,
    WhatsAppCampaignLifecycleResponse,
    WhatsAppCampaignListMeta,
    WhatsAppCampaignListResponse,
    WhatsAppCampaignMetrics,
    WhatsAppCampaignPayload,
    WhatsAppCampaignResetConfirmResponse,
    WhatsAppCampaignResetPrepareResponse,
} from '@/lib/whatsapp-campaigns/types';
import { fetchWithRefresh, getApiBaseUrl, scopeHeaders } from '@/lib/api/browser-client';

import { apiClient } from '@/lib/api/browser-client';

const DEFAULT_WHATSAPP_CAMPAIGN_META: WhatsAppCampaignListMeta = {
    page: 1,
    limit: 10,
    totalPages: 1,
    total: 0,
};

function unwrapWhatsAppCampaign(
    payload?: WhatsAppCampaign | { data?: WhatsAppCampaign } | null,
): WhatsAppCampaign | null {
    if (
        payload &&
        typeof payload === 'object' &&
        'data' in payload &&
        payload.data
    ) {
        return payload.data;
    }

    return (payload as WhatsAppCampaign) ?? null;
}

function normalizeWhatsAppCampaignList(payload?: unknown) {
    const meta: WhatsAppCampaignListMeta = { ...DEFAULT_WHATSAPP_CAMPAIGN_META };
    let campaigns: WhatsAppCampaign[] = [];

    if (!payload) {
        return { campaigns, meta };
    }

    if (Array.isArray(payload)) {
        campaigns = payload;
    } else if (payload && typeof payload === 'object' && 'data' in payload) {
        const payloadData = (payload as Record<string, unknown>).data;
        if (Array.isArray(payloadData)) {
            campaigns = payloadData;
            const apiMeta = (payload as Record<string, unknown>).meta as Record<string, unknown> || {};
            if (apiMeta.totalItems !== undefined) meta.total = apiMeta.totalItems as number;
            if (apiMeta.page !== undefined) meta.page = apiMeta.page as number;
            if (apiMeta.pageSize !== undefined) meta.limit = apiMeta.pageSize as number;
            if (apiMeta.totalPages !== undefined) meta.totalPages = apiMeta.totalPages as number;
        } else if (payloadData && typeof payloadData === 'object') {
            const data = payloadData as Record<string, unknown>;
            campaigns = (data.items as WhatsAppCampaign[]) || [];
            if (data.total !== undefined) meta.total = data.total as number;
            if (data.page !== undefined) meta.page = data.page as number;
            if (data.limit !== undefined) meta.limit = data.limit as number;
            if (data.totalPages !== undefined) meta.totalPages = data.totalPages as number;
        }
    }

    if (!meta.total) {
        meta.total = campaigns.length;
    }

    return { campaigns, meta };
}

export async function listWhatsAppCampaignsAction(page = 1, limit = 10, sort = 'desc', workspaceId?: string, type?: string) {
    const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort,
    });

    if (type) {
        queryParams.set('type', type);
    }

    const response = await apiClient<WhatsAppCampaignListResponse>(
        `/whatsapp/campaigns?${queryParams.toString()}`,
        {
            method: 'GET',
            headers: workspaceId ? { 'X-Workspace-ID': workspaceId } : undefined,
        }
    );

    if (response.error) {
        return {
            campaigns: [] as WhatsAppCampaign[],
            meta: DEFAULT_WHATSAPP_CAMPAIGN_META,
            error: response.error.message,
        };
    }

    const { campaigns, meta } = normalizeWhatsAppCampaignList(response.data ?? null);

    return { campaigns, meta };
}

/**
 * Workspace-level "disparos" (billed sends) rollup for WhatsApp campaigns,
 * aggregated across all campaigns whose creation date falls in [from, to]
 * (all-time when omitted). `type` narrows to "standard"/"organic".
 */
export async function getWhatsAppCampaignsSummaryAction(params: {
    workspaceId?: string;
    type?: string;
    from?: string;
    to?: string;
}) {
    const queryParams = new URLSearchParams();
    if (params.type) queryParams.set('type', params.type);
    if (params.from) queryParams.set('from', params.from);
    if (params.to) queryParams.set('to', params.to);
    const queryString = queryParams.toString();
    const endpoint = `/whatsapp/campaigns/summary${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<WhatsAppCampaignMetrics>(endpoint, {
        method: 'GET',
        headers: params.workspaceId ? { 'X-Workspace-ID': params.workspaceId } : undefined,
    });

    if (response.error) {
        return { metrics: null as WhatsAppCampaignMetrics | null, error: response.error.message };
    }
    return { metrics: response.data ?? null };
}

export async function getWhatsAppCampaignByIdAction(campaignId: string) {
    const response = await apiClient<{ data: WhatsAppCampaign }>(
        `/whatsapp/campaigns/${campaignId}`,
        { method: 'GET' }
    );

    if (response.error) {
        return { campaign: null, error: response.error.message };
    }

    const campaignData = response.data?.data ?? response.data ?? null;

    return { campaign: campaignData as WhatsAppCampaign | null, error: null };
}

export async function createWhatsAppCampaignAction(payload: WhatsAppCampaignPayload) {
    const response = await apiClient<{ success: boolean; data: WhatsAppCampaign }>(
        '/whatsapp/campaigns',
        {
            method: 'POST',
            body: JSON.stringify(payload),
        }
    );

    console.log(JSON.stringify(response))

    if (response.error) {
        return { campaign: null, error: response.error.message };
    }

    return { campaign: unwrapWhatsAppCampaign(response.data ?? null), error: null };
}

export async function updateWhatsAppCampaignAction(
    campaignId: string,
    payload: WhatsAppCampaignPayload
) {
    const response = await apiClient<{ success: boolean; data: WhatsAppCampaign }>(
        `/whatsapp/campaigns/${campaignId}`,
        {
            method: 'PUT',
            body: JSON.stringify(payload),
        }
    );

    console.log(response)

    if (response.error) {
        return { campaign: null, error: response.error.message };
    }

    return { campaign: unwrapWhatsAppCampaign(response.data ?? null), error: null };
}

export async function assignWhatsAppCampaignDepartmentAction(
    campaignId: string,
    departmentId: string,
) {
    const response = await apiClient<WhatsAppCampaign>(
        `/whatsapp/campaigns/${campaignId}/department`,
        {
            method: 'PATCH',
            body: JSON.stringify({ departmentId }),
        }
    );

    console.log(JSON.stringify(response))

    if (response.error) {
        return { campaign: null, error: response.error.message };
    }

    return { campaign: response.data ?? null, error: null };
}

export async function deleteWhatsAppCampaignAction(campaignId: string) {
    const response = await apiClient<WhatsAppCampaignLifecycleResponse>(
        `/whatsapp/campaigns/${campaignId}`,
        {
            method: 'DELETE',
        }
    );

    if (response.error) {
        return { error: response.error.message };
    }

    return { error: null };
}

async function lifecycleAction(campaignId: string, endpoint: string) {
    const response = await apiClient<WhatsAppCampaignLifecycleResponse>(endpoint, {
        method: 'POST',
    });

    if (response.error) {
        const errorCode = response.error.code;
        return { response: null, error: response.error.message, errorCode };
    }

    return { response: response.data ?? null, error: null, errorCode: undefined };
}

export async function startWhatsAppCampaignAction(campaignId: string) {
    return lifecycleAction(campaignId, `/whatsapp/campaigns/${campaignId}/start`);
}

export async function pauseWhatsAppCampaignAction(campaignId: string) {
    return lifecycleAction(campaignId, `/whatsapp/campaigns/${campaignId}/pause`);
}

export async function stopWhatsAppCampaignAction(campaignId: string) {
    return lifecycleAction(campaignId, `/whatsapp/campaigns/${campaignId}/stop`);
}

export async function prepareResetWhatsAppCampaignAction(campaignId: string): Promise<{
    data: { resetCode: string; totalNumbers: number; numbersToReset: number } | null;
    error: string | null;
}> {
    const response = await apiClient<WhatsAppCampaignResetPrepareResponse>(
        `/whatsapp/campaigns/${campaignId}/reset/prepare`,
        { method: 'POST' }
    );


    if (response.error) {
        return { data: null, error: response.error.message };
    }

    const apiResponse = response.data;
    const resetData = apiResponse?.data ?? (apiResponse as unknown as { resetCode: string; totalNumbers: number; numbersToReset: number } | undefined);

    return { data: resetData ?? null, error: null };
}

export async function confirmResetWhatsAppCampaignAction(campaignId: string, resetCode: string) {
    const response = await apiClient<WhatsAppCampaignResetConfirmResponse>(
        `/whatsapp/campaigns/${campaignId}/reset`,
        {
            method: 'POST',
            body: JSON.stringify({ resetCode }),
        }
    );


    if (response.error) {
        return { data: null, error: response.error.message };
    }

    return { data: response.data?.data ?? null, error: null };
}

export async function updateWhatsAppCampaignEntryAction(
    campaignId: string,
    entryId: string,
    payload: { automationEnabled?: boolean | null; name?: string; variables?: string[] }
) {
    const response = await apiClient<{ success: boolean }>(
        `/whatsapp/campaigns/${campaignId}/entries/${entryId}`,
        {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }
    );

    console.log(response)

    if (response.error) {
        return { error: response.error.message };
    }

    return { error: null };
}

const DEFAULT_ENTRIES_META = {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
};

export async function listWhatsAppCampaignEntriesAction(
    campaignId: string,
    params: WhatsAppCampaignEntriesListParams = {}
) {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.set('search', params.search);
    if (params.status) queryParams.set('status', params.status);
    if (params.stageId) queryParams.set('stageId', params.stageId);
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params.sort) queryParams.set('sort', params.sort);
    if (params.order) queryParams.set('order', params.order);
    if (params.interest) queryParams.set('interest', params.interest);
    if (params.disposition) queryParams.set('disposition', params.disposition);
    if (params.sentiment) queryParams.set('sentiment', params.sentiment);
    if (params.qualification) queryParams.set('qualification', params.qualification);
    if (params.nextAction) queryParams.set('nextAction', params.nextAction);
    if (params.attendanceQualityMin !== undefined) queryParams.set('attendanceQualityMin', params.attendanceQualityMin.toString());
    if (params.attendanceQualityMax !== undefined) queryParams.set('attendanceQualityMax', params.attendanceQualityMax.toString());
    if (params.hasAnalysis !== undefined) queryParams.set('hasAnalysis', params.hasAnalysis.toString());
    if (params.hasToolCalls !== undefined) queryParams.set('hasToolCalls', params.hasToolCalls.toString());
    if (params.toolName) queryParams.set('toolName', params.toolName);
    if (params.messageType) queryParams.set('messageType', params.messageType);
    if (params.minMessageCount !== undefined) queryParams.set('minMessageCount', params.minMessageCount.toString());
    if (params.maxMessageCount !== undefined) queryParams.set('maxMessageCount', params.maxMessageCount.toString());
    if (params.errorCode !== undefined) queryParams.set('errorCode', params.errorCode.toString());


    const queryString = queryParams.toString();
    const url = `/whatsapp/campaigns/${campaignId}/entries${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<WhatsAppCampaignEntriesApiResponse>(url, {
        method: 'GET',
    });


    if (response.error) {
        return {
            entries: [] as WhatsAppCampaignEntryWithLead[],
            meta: DEFAULT_ENTRIES_META,
            error: response.error.message,
        };
    }

    const apiBody = response.data;
    const entriesData = apiBody?.data ?? [];
    const responseMeta = apiBody?.meta;

    return {
        entries: entriesData,
        meta: {
            page: responseMeta?.page ?? 1,
            pageSize: responseMeta?.pageSize ?? 20,
            totalPages: responseMeta?.totalPages ?? 1,
            totalItems: responseMeta?.totalItems ?? 0,
        },
        error: null,
    };
}

export async function prepareClearHistoryWhatsAppCampaignAction(campaignId: string): Promise<{
    data: { clearCode: string; messageCount: number } | null;
    error: string | null;
}> {
    const response = await apiClient<WhatsAppCampaignClearHistoryPrepareResponse>(
        `/whatsapp/campaigns/${campaignId}/clear-history/prepare`,
        { method: 'POST' }
    );


    if (response.error) {
        return { data: null, error: response.error.message };
    }

    const apiResponse = response.data;
    const clearData = apiResponse?.data ?? (apiResponse as unknown as { clearCode: string; messageCount: number } | undefined);

    return { data: clearData ?? null, error: null };
}

export async function confirmClearHistoryWhatsAppCampaignAction(campaignId: string, clearCode: string) {
    const response = await apiClient<WhatsAppCampaignClearHistoryConfirmResponse>(
        `/whatsapp/campaigns/${campaignId}/clear-history`,
        {
            method: 'POST',
            body: JSON.stringify({ clearCode }),
        }
    );

    if (response.error) {
        return { data: null, error: response.error.message };
    }

    return { data: response.data?.data ?? null, error: null };
}

export async function listArchivedWhatsAppCampaignsAction(page = 1, limit = 10, sort = 'desc', workspaceId?: string) {
    const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort,
    });

    const response = await apiClient<WhatsAppCampaignListResponse>(
        `/whatsapp/campaigns/archived?${queryParams.toString()}`,
        {
            method: 'GET',
            headers: workspaceId ? { 'X-Workspace-ID': workspaceId } : undefined,
        }
    );

    if (response.error) {
        return {
            campaigns: [] as WhatsAppCampaign[],
            meta: DEFAULT_WHATSAPP_CAMPAIGN_META,
            error: response.error.message,
        };
    }

    const { campaigns, meta } = normalizeWhatsAppCampaignList(response.data ?? null);

    return { campaigns, meta };
}

export async function archiveWhatsAppCampaignAction(campaignId: string) {
    const response = await apiClient<WhatsAppCampaignLifecycleResponse>(
        `/whatsapp/campaigns/${campaignId}/archive`,
        { method: 'PATCH' }
    );

    if (response.error) {
        return { success: false, error: response.error.message };
    }

    return { success: true, error: null };
}

export async function unarchiveWhatsAppCampaignAction(campaignId: string) {
    const response = await apiClient<WhatsAppCampaignLifecycleResponse>(
        `/whatsapp/campaigns/${campaignId}/unarchive`,
        { method: 'PATCH' }
    );

    if (response.error) {
        return { success: false, error: response.error.message };
    }

    return { success: true, error: null };
}

export type CsvExportResult = {
    csvText: string | null;
    filename: string;
    error: string | null;
};

/**
 * Build a query string, dropping empty values, and repeating a key per item for
 * array values — `status: ['SENT','READ']` becomes `status=SENT&status=READ`,
 * which is how the backend reads a multi-status filter.
 */
function exportQueryString(filters?: Record<string, string | string[] | undefined>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters ?? {})) {
        if (Array.isArray(value)) {
            for (const item of value) {
                if (item) params.append(key, item);
            }
        } else if (value) {
            params.set(key, value);
        }
    }
    return params.toString();
}

/**
 * Fetch a CSV export endpoint.
 *
 * The response is raw CSV rather than JSON, so this uses fetch directly instead
 * of apiClient; auth rides the httpOnly cookie (credentials: include) with
 * refresh-on-401. Shared by the per-campaign and workspace-wide exports so the
 * two cannot disagree about how a filename or an error is read.
 */
async function fetchCsv(path: string, filters?: Record<string, string | string[] | undefined>): Promise<CsvExportResult> {
    const queryString = exportQueryString(filters);
    const url = `${getApiBaseUrl()}${path}${queryString ? `?${queryString}` : ''}`;

    const response = await fetchWithRefresh(() =>
        fetch(url, { credentials: 'include', headers: scopeHeaders() }),
    );
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        const msg = (body as { message?: string })?.message;
        if (response.status === 404) {
            return { csvText: null, filename: '', error: 'noEntries' };
        }
        // 413 and 429 are the two the operator can act on: narrow the period, or
        // wait. They get their own codes so the UI can say which.
        if (response.status === 413) {
            return { csvText: null, filename: '', error: 'tooLarge' };
        }
        if (response.status === 429) {
            return { csvText: null, filename: '', error: 'busy' };
        }
        return { csvText: null, filename: '', error: msg || 'Failed to export' };
    }

    const csvText = await response.text();

    const disposition = response.headers.get('Content-Disposition');
    let filename = `whatsapp-campaign-export-${new Date().toISOString().slice(0, 10)}.csv`;
    if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match?.[1]) filename = match[1];
    }

    return { csvText, filename, error: null };
}

export async function exportWhatsAppCampaignEntriesAction(
    campaignId: string,
    filters?: Record<string, string | string[] | undefined>
): Promise<CsvExportResult> {
    return fetchCsv(`/whatsapp/campaigns/${campaignId}/entries/export`, filters);
}

/**
 * Export the leads behind the "Disparos WhatsApp" tiles — every campaign in the
 * period, in one file.
 *
 * Same recorte as getWhatsAppCampaignsSummaryAction (campaign creation date,
 * type, and the department scope carried on the request headers), so the file
 * and the numbers above it answer the same question. `statuses` chooses which
 * sends: the three dispatched ones for "enviados, entregues e lidos", or none
 * for everything.
 */
export async function exportWhatsAppWorkspaceEntriesAction(params: {
    statuses?: string[];
    type?: string;
    from?: string;
    to?: string;
    search?: string;
}): Promise<CsvExportResult> {
    return fetchCsv('/whatsapp/campaigns/entries/export', {
        status: params.statuses,
        type: params.type,
        from: params.from,
        to: params.to,
        search: params.search,
    });
}
