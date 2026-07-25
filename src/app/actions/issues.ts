import type {
    CreateIssuePayload,
    CreateIssueResponsePayload,
    Issue,
    IssueListMeta,
    IssueListParams,
    IssueResponse,
} from '@/lib/issues/types';

import { apiClient } from "@/lib/api/browser-client";

const DEFAULT_META: IssueListMeta = {
    page: 1,
    pageSize: 0,
    totalPages: 1,
    totalItems: 0,
};

interface IssueListResponse {
    data?: Issue[];
    meta?: IssueListMeta;
}

function normalizeIssueList(payload?: IssueListResponse | Issue[] | null) {
    const meta: IssueListMeta = { ...DEFAULT_META };
    let issues: Issue[] = [];

    if (!payload) {
        return { issues, meta };
    }

    if (Array.isArray(payload)) {
        issues = payload;
    } else {
        if (Array.isArray(payload.data)) {
            issues = payload.data;
        }
        if (payload.meta) {
            meta.page = payload.meta.page ?? meta.page;
            meta.pageSize = payload.meta.pageSize ?? meta.pageSize;
            meta.totalPages = payload.meta.totalPages ?? meta.totalPages;
            meta.totalItems = payload.meta.totalItems ?? meta.totalItems;
        }
    }

    if (!meta.pageSize) meta.pageSize = issues.length;
    if (!meta.totalItems) meta.totalItems = issues.length;

    return { issues, meta };
}

export async function listIssuesAction(params?: IssueListParams) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));
    if (params?.status && params.status !== 'all') queryParams.set('status', params.status);
    if (params?.search) queryParams.set('search', params.search);
    if (params?.sortBy) queryParams.set('sortBy', params.sortBy);
    if (params?.sortDir) queryParams.set('sortDir', params.sortDir);
    const queryString = queryParams.toString();
    const endpoint = `/issues${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<IssueListResponse>(endpoint, {
        method: 'GET',
        headers: params?.workspaceId ? { 'X-Workspace-ID': params.workspaceId } : undefined,
    });

    if (response.error) {
        return { issues: [] as Issue[], meta: DEFAULT_META, error: response.error.message };
    }

    const { issues, meta } = normalizeIssueList(response.data ?? null);
    return { issues, meta };
}

export async function getIssueAction(issueId: string) {
    const response = await apiClient<Issue>(`/issues/${issueId}`, { method: 'GET' });

    if (response.error) {
        return { issue: null as Issue | null, error: response.error.message };
    }

    return { issue: response.data ?? null, error: null };
}

export async function createIssueAction(payload: CreateIssuePayload) {
    const response = await apiClient<Issue>('/issues', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { issue: null as Issue | null, error: response.error.message };
    }

    return { issue: response.data ?? null, error: null };
}

export async function closeIssueAction(issueId: string) {
    const response = await apiClient<Issue>(`/issues/${issueId}/close`, { method: 'PATCH' });

    if (response.error) {
        return { issue: null as Issue | null, error: response.error.message };
    }

    return { issue: response.data ?? null, error: null };
}

export async function listIssueResponsesAction(issueId: string) {
    const response = await apiClient<IssueResponse[]>(`/issues/${issueId}/responses`, { method: 'GET' });

    if (response.error) {
        return { responses: [] as IssueResponse[], error: response.error.message };
    }

    return { responses: response.data ?? [], error: null };
}

export async function createIssueResponseAction(issueId: string, payload: CreateIssueResponsePayload) {
    const result = await apiClient<IssueResponse>(`/issues/${issueId}/responses`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    if (result.error) {
        return { response: null as IssueResponse | null, error: result.error.message };
    }

    return { response: result.data ?? null, error: null };
}


export async function adminListIssuesAction(params?: IssueListParams) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));
    if (params?.status && params.status !== 'all') queryParams.set('status', params.status);
    if (params?.search) queryParams.set('search', params.search);
    if (params?.sortBy) queryParams.set('sortBy', params.sortBy);
    if (params?.sortDir) queryParams.set('sortDir', params.sortDir);
    const queryString = queryParams.toString();
    const endpoint = `/admin/issues${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient<IssueListResponse>(endpoint, { method: 'GET' });

    if (response.error) {
        return { issues: [] as Issue[], meta: DEFAULT_META, error: response.error.message };
    }

    const { issues, meta } = normalizeIssueList(response.data ?? null);
    return { issues, meta };
}

export async function adminUpdateIssueStatusAction(issueId: string, status: string) {
    const response = await apiClient<Issue>(`/admin/issues/${issueId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });

    if (response.error) {
        return { issue: null as Issue | null, error: response.error.message };
    }

    return { issue: response.data ?? null, error: null };
}

export async function adminGetIssueAction(issueId: string) {
    const response = await apiClient<Issue>(`/admin/issues/${issueId}`, { method: 'GET' });

    if (response.error) {
        return { issue: null as Issue | null, error: response.error.message };
    }

    return { issue: response.data ?? null, error: null };
}

export async function adminListIssueResponsesAction(issueId: string) {
    const response = await apiClient<IssueResponse[]>(`/admin/issues/${issueId}/responses`, { method: 'GET' });

    if (response.error) {
        return { responses: [] as IssueResponse[], error: response.error.message };
    }

    return { responses: response.data ?? [], error: null };
}

export async function adminCreateIssueResponseAction(issueId: string, payload: CreateIssueResponsePayload) {
    const result = await apiClient<IssueResponse>(`/admin/issues/${issueId}/responses`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    if (result.error) {
        return { response: null as IssueResponse | null, error: result.error.message };
    }

    return { response: result.data ?? null, error: null };
}
