import type {
    GrantPhoneAccessPayload,
    GrantPhoneAccessResponse,
    PhoneAccess,
    PhoneAccessListResponse,
    PhoneAccessMeta,
    RevokePhoneAccessResponse,
} from '@/lib/whatsapp-business-phones/types';

import { apiClient } from "@/lib/api/browser-client";

const DEFAULT_ACCESS_META: PhoneAccessMeta = {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
};

export async function listPhoneAccessAction(
    phoneId: string,
    params: { page?: number; pageSize?: number } = {},
) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', String(params.page));
    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize));

    const queryString = queryParams.toString();
    const endpoint = `/admin/phones/${phoneId}/access${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<PhoneAccessListResponse>(endpoint, {
        method: 'GET',
    });

    if (response.error) {
        return {
            items: [] as PhoneAccess[],
            meta: DEFAULT_ACCESS_META,
            error: response.error.message,
        };
    }

    const payload = (response.data?.data ?? response.data) as
        | PhoneAccessListResponse
        | PhoneAccessListResponse['data']
        | null
        | undefined;
    const items = Array.isArray(payload)
        ? payload
        : (payload as { items?: PhoneAccess[] } | null)?.items ?? [];

    return {
        items,
        meta: {
            page:
                (payload as { page?: number; page_number?: number } | null)?.page ??
                (payload as { page?: number; page_number?: number } | null)?.page_number ??
                1,
            pageSize:
                (payload as { pageSize?: number; page_size?: number } | null)?.pageSize ??
                (payload as { pageSize?: number; page_size?: number } | null)?.page_size ??
                params.pageSize ??
                20,
            totalPages:
                (payload as { totalPages?: number; total_pages?: number } | null)?.totalPages ??
                (payload as { totalPages?: number; total_pages?: number } | null)?.total_pages ??
                1,
            totalItems:
                (payload as { totalItems?: number; total_items?: number } | null)?.totalItems ??
                (payload as { totalItems?: number; total_items?: number } | null)?.total_items ??
                items.length,
        },
        error: null,
    };
}

export async function listWorkspacePhoneAccessAction(
    workspaceId: string,
    params: { page?: number; pageSize?: number } = {},
) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', String(params.page));
    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize));

    const queryString = queryParams.toString();
    const endpoint = `/admin/workspaces/${workspaceId}/phone-access${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<PhoneAccessListResponse>(endpoint, {
        method: 'GET',
    });

    if (response.error) {
        return {
            items: [] as PhoneAccess[],
            meta: DEFAULT_ACCESS_META,
            error: response.error.message,
        };
    }

    const payload = (response.data?.data ?? response.data) as
        | PhoneAccessListResponse
        | PhoneAccessListResponse['data']
        | null
        | undefined;
    const items = Array.isArray(payload)
        ? payload
        : (payload as { items?: PhoneAccess[] } | null)?.items ?? [];

    return {
        items,
        meta: {
            page:
                (payload as { page?: number; page_number?: number } | null)?.page ??
                (payload as { page?: number; page_number?: number } | null)?.page_number ??
                1,
            pageSize:
                (payload as { pageSize?: number; page_size?: number } | null)?.pageSize ??
                (payload as { pageSize?: number; page_size?: number } | null)?.page_size ??
                params.pageSize ??
                20,
            totalPages:
                (payload as { totalPages?: number; total_pages?: number } | null)?.totalPages ??
                (payload as { totalPages?: number; total_pages?: number } | null)?.total_pages ??
                1,
            totalItems:
                (payload as { totalItems?: number; total_items?: number } | null)?.totalItems ??
                (payload as { totalItems?: number; total_items?: number } | null)?.total_items ??
                items.length,
        },
        error: null,
    };
}

export async function grantPhoneAccessAction(payload: GrantPhoneAccessPayload) {
    const response = await apiClient<GrantPhoneAccessResponse>(`/admin/phone-access`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { success: false, error: response.error.message };
    }

    return { success: true, data: response.data?.data ?? null, error: null };
}

export async function revokePhoneAccessAction(payload: { workspaceId: string; phoneId: string }) {
    const response = await apiClient<RevokePhoneAccessResponse>(`/admin/phone-access`, {
        method: 'DELETE',
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { success: false, error: response.error.message };
    }

    return { success: true, error: null };
}

export async function getMyPhoneAccessAction(phoneId: string) {
    const response = await apiClient<{ data?: PhoneAccess }>(`/whatsapp/phone-access/me/${phoneId}`, {
        method: 'GET',
    });

    if (response.error) {
        return { access: null as PhoneAccess | null, error: response.error.message };
    }

    const accessData = response.data?.data ?? response.data ?? null;
    return { access: accessData as PhoneAccess | null, error: null };
}
