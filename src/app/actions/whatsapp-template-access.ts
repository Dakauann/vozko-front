import type {
    TemplateAccess,
    TemplateAccessListResponse,
    TemplateAccessMeta,
} from '@/lib/whatsapp-templates/types';

import { apiClient } from "@/lib/api/browser-client";

const DEFAULT_ACCESS_META: TemplateAccessMeta = {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
};

export async function listTemplateAccessAction(
    templateId: string,
    params: { page?: number; pageSize?: number } = {},
) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', String(params.page));
    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize));

    const queryString = queryParams.toString();
    const endpoint = `/admin/templates/${templateId}/access${queryString ? `?${queryString}` : ''
        }`;

    const response = await apiClient<TemplateAccessListResponse>(endpoint, {
        method: 'GET',
    });

    if (response.error) {
        return {
            items: [] as TemplateAccess[],
            meta: DEFAULT_ACCESS_META,
            error: response.error.message,
        };
    }

    const payload = (response.data?.data ?? response.data) as
        | TemplateAccessListResponse
        | TemplateAccessListResponse['data']
        | null
        | undefined;
    const items = (payload as { items?: TemplateAccess[] } | null)?.items ?? [];

    return {
        items,
        meta: {
            page:
                (payload as { page?: number; page_number?: number } | null)?.page ??
                (payload as { page?: number; page_number?: number } | null)
                    ?.page_number ??
                1,
            pageSize:
                (payload as { pageSize?: number; page_size?: number } | null)
                    ?.pageSize ??
                (payload as { pageSize?: number; page_size?: number } | null)
                    ?.page_size ??
                params.pageSize ??
                20,
            totalPages:
                (payload as { totalPages?: number; total_pages?: number } | null)
                    ?.totalPages ??
                (payload as { totalPages?: number; total_pages?: number } | null)
                    ?.total_pages ??
                1,
            totalItems:
                (payload as { totalItems?: number; total_items?: number } | null)
                    ?.totalItems ??
                (payload as { totalItems?: number; total_items?: number } | null)
                    ?.total_items ??
                items.length,
        },
        error: null,
    };
}

export async function grantTemplateAccessAction(payload: {
    workspaceId: string;
    templateId: string;
}) {
    const response = await apiClient<{ data?: TemplateAccess }>(`/admin/template-access`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { success: false, error: response.error.message };
    }

    return { success: true, data: response.data?.data ?? null, error: null };
}

export async function revokeTemplateAccessAction(payload: {
    workspaceId: string;
    templateId: string;
}) {
    const response = await apiClient<{ data?: null }>(`/admin/template-access`, {
        method: 'DELETE',
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { success: false, error: response.error.message };
    }

    return { success: true, data: response.data?.data ?? null, error: null };
}

export async function getMyTemplateAccessAction(templateId: string) {
    const response = await apiClient<{ data?: TemplateAccess }>(`/whatsapp/template-access/me/${templateId}`, {
        method: 'GET',
    });

    if (response.error) {
        return { access: null as TemplateAccess | null, error: response.error.message };
    }

    const accessData = response.data?.data ?? response.data ?? null;
    return { access: accessData as TemplateAccess | null, error: null };
}
