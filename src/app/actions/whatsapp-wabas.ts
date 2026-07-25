import type {
    WABAListMeta,
    WABAListResponse,
    WhatsAppBusinessAccount,
} from '@/lib/whatsapp-wabas/types';

import { apiClient } from "@/lib/api/browser-client";

const DEFAULT_META: WABAListMeta = {
    page: 1,
    pageSize: 50,
    totalPages: 1,
    totalItems: 0,
};

export async function listWABAsAction(params?: { page?: number; pageSize?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));

    const queryString = queryParams.toString();
    const endpoint = `/whatsapp/wabas${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<WABAListResponse>(endpoint, {
        method: 'GET',
    });

    if (response.error) {
        return {
            wabas: [] as WhatsAppBusinessAccount[],
            meta: DEFAULT_META,
            error: response.error.message,
        };
    }

    const payload = response.data;
    const wabas: WhatsAppBusinessAccount[] = Array.isArray(payload?.data) ? payload.data : [];
    const meta: WABAListMeta = {
        page: payload?.meta?.page ?? 1,
        pageSize: payload?.meta?.pageSize ?? 50,
        totalPages: payload?.meta?.totalPages ?? 1,
        totalItems: payload?.meta?.totalItems ?? wabas.length,
    };

    return { wabas, meta, error: null };
}
