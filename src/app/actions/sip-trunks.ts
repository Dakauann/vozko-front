import type {
    AdminCreateSipTrunkPayload,
    AdminUpdateSipTrunkPayload,
    CreateSipTrunkPayload,
    DeleteSipTrunkResponse,
    EnableSipTrunkPayload,
    SipTrunk,
    SipTrunkListMeta,
    SipTrunkListParams,
    SipTrunkListResponse,
    SipTrunkStatus,
    SupportedCodec,
    UpdateSipTrunkPayload,
} from '@/lib/sip-trunks/types';

import { apiClient } from '@/lib/api/browser-client';

const DEFAULT_LIST_META: SipTrunkListMeta = {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
};

function normalizeSipTrunkList(payload?: SipTrunkListResponse | SipTrunk[] | null) {
    const meta: SipTrunkListMeta = { ...DEFAULT_LIST_META };
    let trunks: SipTrunk[] = [];

    if (!payload) {
        return { trunks, meta };
    }

    if (Array.isArray(payload)) {
        trunks = payload;
    } else {
        if (Array.isArray(payload.items)) {
            trunks = payload.items;
        } else if (Array.isArray(payload.data)) {
            trunks = payload.data;
        }

        if (payload.meta) {
            meta.page = payload.meta.page ?? meta.page;
            meta.pageSize = payload.meta.pageSize ?? meta.pageSize;
            meta.totalPages = payload.meta.totalPages ?? meta.totalPages;
            meta.totalItems = payload.meta.totalItems ?? meta.totalItems;
        } else {
            meta.page = payload.page ?? meta.page;
            meta.pageSize = payload.pageSize ?? meta.pageSize;
            meta.totalItems = payload.total ?? trunks.length;
            meta.totalPages = Math.ceil(meta.totalItems / meta.pageSize) || 1;
        }
    }

    if (!meta.pageSize) {
        meta.pageSize = trunks.length;
    }

    if (!meta.totalItems) {
        meta.totalItems = trunks.length;
    }

    return { trunks, meta };
}

export async function listSipTrunksAction(params: SipTrunkListParams = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', String(params.page));
    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize));

    const queryString = queryParams.toString();
    const endpoint = `/sip-trunks${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<SipTrunkListResponse>(endpoint, {
        method: 'GET',
    });

    console.log(response)

    if (response.error) {
        return {
            trunks: [] as SipTrunk[],
            meta: DEFAULT_LIST_META,
            error: response.error.message,
        };
    }

    const { trunks, meta } = normalizeSipTrunkList(response.data);

    return {
        trunks,
        meta,
        error: null,
    };
}

export async function getSupportedCodecsAction() {
    const response = await apiClient<SupportedCodec[]>('/sip-trunks/codecs', {
        method: 'GET',
    });

    if (response.error) {
        return { codecs: [] as SupportedCodec[], error: response.error.message };
    }

    return { codecs: response.data ?? [], error: null };
}

export async function getSipTrunkAction(trunkId: string) {
    const response = await apiClient<SipTrunk>(`/sip-trunks/${trunkId}`, {
        method: 'GET',
    });

    if (response.error) {
        return { trunk: null, error: response.error.message };
    }

    return { trunk: response.data ?? null, error: null };
}

export async function createSipTrunkAction(payload: CreateSipTrunkPayload) {
    const response = await apiClient<SipTrunk>('/sip-trunks', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { trunk: null, error: response.error.message };
    }

    return { trunk: response.data ?? null, error: null };
}

export async function updateSipTrunkAction(trunkId: string, payload: UpdateSipTrunkPayload) {
    const response = await apiClient<SipTrunk>(`/sip-trunks/${trunkId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { trunk: null, error: response.error.message };
    }

    return { trunk: response.data ?? null, error: null };
}

export async function deleteSipTrunkAction(trunkId: string) {
    const response = await apiClient<DeleteSipTrunkResponse>(`/sip-trunks/${trunkId}`, {
        method: 'DELETE',
    });

    if (response.error) {
        return { success: false, error: response.error.message };
    }

    return { success: true, error: null };
}

export async function toggleSipTrunkAction(trunkId: string, payload: EnableSipTrunkPayload) {
    const response = await apiClient<SipTrunk>(`/sip-trunks/${trunkId}/enable`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { trunk: null, error: response.error.message };
    }

    return { trunk: response.data ?? null, error: null };
}

export async function getSipTrunkStatusAction(trunkId: string) {
    const response = await apiClient<SipTrunkStatus>(`/sip-trunks/${trunkId}/status`, {
        method: 'GET',
    });

    if (response.error) {
        return { status: null, error: response.error.message };
    }

    return { status: response.data ?? null, error: null };
}


export async function adminListSipTrunksAction(params: SipTrunkListParams = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', String(params.page));
    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize));
    const queryString = queryParams.toString();
    const endpoint = `/sip-trunks${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<SipTrunkListResponse>(endpoint, {
        method: 'GET',
    });

    if (response.error) {
        return {
            trunks: [] as SipTrunk[],
            meta: DEFAULT_LIST_META,
            error: response.error.message,
        };
    }

    const { trunks, meta } = normalizeSipTrunkList(response.data ?? null);
    return { trunks, meta, error: null };
}

export async function adminGetSipTrunkAction(trunkId: string) {
    const response = await apiClient<SipTrunk>(`/admin/sip-trunks/${trunkId}`, {
        method: 'GET',
    });

    if (response.error) {
        return { trunk: null, error: response.error.message };
    }

    return { trunk: response.data ?? null, error: null };
}

export async function adminCreateSipTrunkAction(payload: AdminCreateSipTrunkPayload) {
    const response = await apiClient<SipTrunk>('/admin/sip-trunks', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { trunk: null, error: response.error.message };
    }

    return { trunk: response.data ?? null, error: null };
}

export async function adminUpdateSipTrunkAction(
    trunkId: string,
    payload: AdminUpdateSipTrunkPayload,
) {
    const response = await apiClient<SipTrunk>(`/admin/sip-trunks/${trunkId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { trunk: null, error: response.error.message };
    }

    return { trunk: response.data ?? null, error: null };
}

export async function adminDeleteSipTrunkAction(trunkId: string) {
    const response = await apiClient<DeleteSipTrunkResponse>(`/admin/sip-trunks/${trunkId}`, {
        method: 'DELETE',
    });

    if (response.error) {
        return { success: false, error: response.error.message };
    }

    return { success: true, error: null };
}

export async function adminToggleSipTrunkAction(
    trunkId: string,
    payload: EnableSipTrunkPayload,
) {
    const response = await apiClient<SipTrunk>(`/admin/sip-trunks/${trunkId}/enable`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { trunk: null, error: response.error.message };
    }

    return { trunk: response.data ?? null, error: null };
}


export async function assignOwnerSipTrunkAction(trunkId: string, workspaceId: string) {
    const response = await apiClient<SipTrunk>(`/admin/sip-trunks/${trunkId}/owner`, {
        method: 'PATCH',
        body: JSON.stringify({ workspaceId }),
    });

    if (response.error) {
        return { trunk: null as SipTrunk | null, error: response.error.message };
    }

    return { trunk: response.data ?? null, error: null };
}
