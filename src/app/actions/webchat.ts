import type {
    WebchatWidget,
    WebchatWidgetListMeta,
    WebchatWidgetRequest,
} from '@/lib/webchat/types';

import { apiClient, type ApiResult } from '@/lib/api/browser-client';

export interface WebchatActionError {
    error: string;
    code?: string;
}

const DEFAULT_META: WebchatWidgetListMeta = {
    page: 1,
    pageSize: 15,
    totalPages: 1,
    totalItems: 0,
};

interface ListApiResponse {
    data: WebchatWidget[];
    meta: WebchatWidgetListMeta;
}

function failure(result: ApiResult<unknown>): WebchatActionError {
    return { error: result.error?.message ?? 'Request failed', code: result.error?.code };
}

function widgetPath(widgetId: string): string {
    return `/webchat/widgets/${encodeURIComponent(widgetId)}`;
}

export async function listWebchatWidgetsAction(page = 1, pageSize = 15, search?: string) {
    const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
    });
    if (search) params.set('search', search);

    const response = await apiClient<ListApiResponse>(`/webchat/widgets?${params.toString()}`, {
        method: 'GET',
    });
    if (response.error) {
        return { widgets: [] as WebchatWidget[], meta: DEFAULT_META, ...failure(response) };
    }
    return {
        widgets: response.data?.data ?? [],
        meta: response.data?.meta ?? DEFAULT_META,
    };
}

export async function getWebchatWidgetAction(widgetId: string) {
    const response = await apiClient<WebchatWidget>(widgetPath(widgetId), { method: 'GET' });
    if (response.error) return failure(response);
    return { widget: response.data };
}

export async function createWebchatWidgetAction(payload: WebchatWidgetRequest) {
    const response = await apiClient<WebchatWidget>('/webchat/widgets', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    if (response.error) return failure(response);
    return { widget: response.data };
}

export async function updateWebchatWidgetAction(widgetId: string, payload: WebchatWidgetRequest) {
    const response = await apiClient<WebchatWidget>(widgetPath(widgetId), {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    if (response.error) return failure(response);
    return { widget: response.data };
}

export async function deleteWebchatWidgetAction(widgetId: string) {
    const response = await apiClient<void>(widgetPath(widgetId), { method: 'DELETE' });
    if (response.error) return failure(response);
    return { success: true };
}

export async function revealWebchatIdentitySecretAction(widgetId: string) {
    const response = await apiClient<{ identitySecret: string }>(`${widgetPath(widgetId)}/identity-secret`, {
        method: 'GET',
    });
    if (response.error) return failure(response);
    return { identitySecret: response.data?.identitySecret ?? '' };
}

export async function rotateWebchatIdentitySecretAction(widgetId: string) {
    const response = await apiClient<{ identitySecret: string }>(`${widgetPath(widgetId)}/identity-secret`, {
        method: 'POST',
    });
    if (response.error) return failure(response);
    return { identitySecret: response.data?.identitySecret ?? '' };
}

export async function setWebchatVisitorBlockedAction(entryId: string, blocked: boolean) {
    const response = await apiClient<void>(`/webchat/conversations/${encodeURIComponent(entryId)}/block`, {
        method: 'PUT',
        body: JSON.stringify({ blocked }),
    });
    if (response.error) return failure(response);
    return { success: true };
}
