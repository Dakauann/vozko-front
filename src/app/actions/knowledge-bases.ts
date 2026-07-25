import type { KnowledgeBase } from '@/lib/knowledge-base/types';
import { apiClient } from "@/lib/api/browser-client";

interface KBListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

interface KBListResponse {
    data?: KnowledgeBase[];
    items?: KnowledgeBase[];
    meta?: Partial<KBListMeta>;
}

const DEFAULT_META: KBListMeta = {
    page: 1,
    pageSize: 0,
    totalPages: 1,
    totalItems: 0,
};

function normalizeKBList(payload?: KBListResponse | KnowledgeBase[] | null) {
    const meta: KBListMeta = { ...DEFAULT_META };
    let knowledgeBases: KnowledgeBase[] = [];

    if (!payload) return { knowledgeBases, meta };

    if (Array.isArray(payload)) {
        knowledgeBases = payload;
    } else {
        if (Array.isArray(payload.data)) {
            knowledgeBases = payload.data;
        } else if (Array.isArray(payload.items)) {
            knowledgeBases = payload.items;
        }

        if (payload.meta) {
            meta.page = payload.meta.page ?? meta.page;
            meta.pageSize = payload.meta.pageSize ?? meta.pageSize;
            meta.totalPages = payload.meta.totalPages ?? meta.totalPages;
            meta.totalItems = payload.meta.totalItems ?? meta.totalItems;
        }
    }

    if (!meta.pageSize) meta.pageSize = knowledgeBases.length;
    if (!meta.totalItems) meta.totalItems = knowledgeBases.length;

    return { knowledgeBases, meta };
}

export async function listKnowledgeBasesAction(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
}) {
    const qp = new URLSearchParams();
    if (params?.page) qp.set('page', String(params.page));
    if (params?.pageSize) qp.set('pageSize', String(params.pageSize));
    if (params?.search) qp.set('search', params.search);
    const qs = qp.toString();
    const endpoint = `/knowledge-bases${qs ? `?${qs}` : ''}`;

    const response = await apiClient<KBListResponse>(endpoint, { method: 'GET' });

    if (response.error) {
        return {
            knowledgeBases: [] as KnowledgeBase[],
            meta: DEFAULT_META,
            error: response.error.message,
        };
    }

    const { knowledgeBases, meta } = normalizeKBList(response.data ?? null);
    return { knowledgeBases, meta };
}
