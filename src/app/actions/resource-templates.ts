import type {
    CreateTemplatePayload,
    ResourceTemplate,
    TemplateInstall,
    TemplateListMeta,
    TemplateListParams,
    TemplateListResponse,
    UpdateTemplatePayload,
} from '@/lib/resource-templates/types';

import { apiClient } from "@/lib/api/browser-client";

const DEFAULT_META: TemplateListMeta = {
    page: 1,
    pageSize: 0,
    totalPages: 1,
    totalItems: 0,
};

function normalizeList(payload?: TemplateListResponse | ResourceTemplate[] | null) {
    const meta: TemplateListMeta = { ...DEFAULT_META };
    let templates: ResourceTemplate[] = [];

    if (!payload) return { templates, meta };

    if (Array.isArray(payload)) {
        templates = payload;
    } else {
        templates = payload.items ?? payload.data ?? [];
        if (payload.page) meta.page = payload.page;
        if (payload.page_size) meta.pageSize = payload.page_size;
        if (payload.total_items) meta.totalItems = payload.total_items;
        if (payload.total_pages) meta.totalPages = payload.total_pages;
    }

    if (!meta.pageSize) meta.pageSize = templates.length;
    if (!meta.totalItems) meta.totalItems = templates.length;

    return { templates, meta };
}

function buildQuery(params?: TemplateListParams): string {
    if (!params) return '';
    const qp = new URLSearchParams();
    if (params.page) qp.set('page', String(params.page));
    if (params.pageSize) qp.set('pageSize', String(params.pageSize));
    if (params.search) qp.set('search', params.search);
    if (params.resourceType) qp.set('resourceType', params.resourceType);
    if (params.category) qp.set('category', params.category);
    if (params.subcategory) qp.set('subcategory', params.subcategory);
    if (params.status) qp.set('status', params.status);
    if (params.featured !== undefined) qp.set('featured', String(params.featured));
    if (params.sort) qp.set('sort', params.sort);
    const qs = qp.toString();
    return qs ? `?${qs}` : '';
}

export async function listCatalogTemplatesAction(params?: TemplateListParams) {
    const response = await apiClient<TemplateListResponse>(`/resource-templates/catalog${buildQuery(params)}`, { method: 'GET' });

    if (response.error) {
        return { templates: [] as ResourceTemplate[], meta: DEFAULT_META, error: response.error.message };
    }

    const { templates, meta } = normalizeList(response.data ?? null);
    return { templates, meta };
}

export async function getCatalogTemplateAction(id: string) {
    const response = await apiClient<ResourceTemplate>(`/resource-templates/catalog/${id}`, { method: 'GET' });

    if (response.error) {
        return { template: null, error: response.error.message };
    }
    return { template: response.data ?? null };
}

export async function installTemplateAction(templateId: string, departmentId?: string) {
    const response = await apiClient<TemplateInstall>(`/resource-templates/${templateId}/install`, {
        method: 'POST',
        body: JSON.stringify({ departmentId: departmentId ?? '' }),
    });

    if (response.error) {
        return { install: null, error: response.error.message };
    }
    return { install: response.data ?? null, error: null };
}

export async function listInstalledTemplatesAction() {
    const response = await apiClient<TemplateInstall[]>('/resource-templates/installed', { method: 'GET' });

    if (response.error) {
        return { installs: [] as TemplateInstall[], error: response.error.message };
    }
    return { installs: response.data ?? [], error: null };
}

export async function adminListTemplatesAction(params?: TemplateListParams) {
    const response = await apiClient<TemplateListResponse>(`/admin/resource-templates${buildQuery(params)}`, { method: 'GET' });

    if (response.error) {
        return { templates: [] as ResourceTemplate[], meta: DEFAULT_META, error: response.error.message };
    }

    const { templates, meta } = normalizeList(response.data ?? null);
    return { templates, meta };
}

export async function adminGetTemplateAction(id: string) {
    const response = await apiClient<ResourceTemplate>(`/admin/resource-templates/${id}`, { method: 'GET' });

    if (response.error) {
        return { template: null, error: response.error.message };
    }
    return { template: response.data ?? null };
}

export async function adminCreateTemplateAction(data: CreateTemplatePayload) {
    const response = await apiClient<ResourceTemplate>('/admin/resource-templates', {
        method: 'POST',
        body: JSON.stringify(data),
    });

    if (response.error) {
        return { template: null, error: response.error.message };
    }
    return { template: response.data ?? null, error: null };
}

export async function adminUpdateTemplateAction(id: string, data: UpdateTemplatePayload) {
    const response = await apiClient<ResourceTemplate>(`/admin/resource-templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });

    if (response.error) {
        return { template: null, error: response.error.message };
    }
    return { template: response.data ?? null, error: null };
}

export async function adminDeleteTemplateAction(id: string) {
    const response = await apiClient<void>(`/admin/resource-templates/${id}`, { method: 'DELETE' });

    if (response.error) {
        return { success: false, error: response.error.message };
    }
    return { success: true, error: null };
}

export async function adminPublishTemplateAction(id: string) {
    const response = await apiClient<ResourceTemplate>(`/admin/resource-templates/${id}/publish`, { method: 'POST' });

    if (response.error) {
        return { template: null, error: response.error.message };
    }
    return { template: response.data ?? null, error: null };
}

export async function adminArchiveTemplateAction(id: string) {
    const response = await apiClient<ResourceTemplate>(`/admin/resource-templates/${id}/archive`, { method: 'POST' });

    if (response.error) {
        return { template: null, error: response.error.message };
    }
    return { template: response.data ?? null, error: null };
}
