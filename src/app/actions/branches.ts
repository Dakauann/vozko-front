import type {
    Branch,
    BranchConnectionInfo,
    BranchListMeta,
    BranchListParams,
    BranchListResponse,
    BranchSecretResult,
    CreateBranchPayload,
    DeleteBranchResponse,
    EnableBranchPayload,
    UpdateBranchPayload,
} from '@/lib/branches/types';

import { apiClient } from "@/lib/api/browser-client";

const DEFAULT_LIST_META: BranchListMeta = {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
};

function normalizeBranchList(payload?: BranchListResponse | Branch[] | null) {
    const meta: BranchListMeta = { ...DEFAULT_LIST_META };
    let branches: Branch[] = [];

    if (!payload) {
        return { branches, meta };
    }

    if (Array.isArray(payload)) {
        branches = payload;
    } else {
        if (Array.isArray(payload.items)) {
            branches = payload.items;
        } else if (Array.isArray(payload.data)) {
            branches = payload.data;
        }

        if (payload.meta) {
            meta.page = payload.meta.page ?? meta.page;
            meta.pageSize = payload.meta.pageSize ?? meta.pageSize;
            meta.totalPages = payload.meta.totalPages ?? meta.totalPages;
            meta.totalItems = payload.meta.totalItems ?? meta.totalItems;
        } else {
            meta.page = payload.page ?? meta.page;
            meta.pageSize = payload.pageSize ?? meta.pageSize;
            meta.totalItems = payload.total ?? branches.length;
            meta.totalPages = Math.ceil(meta.totalItems / meta.pageSize) || 1;
        }
    }

    if (!meta.pageSize) meta.pageSize = branches.length;
    if (!meta.totalItems) meta.totalItems = branches.length;

    return { branches, meta };
}

function listQuery(base: string, params: BranchListParams): string {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    const s = q.toString();
    return `${base}${s ? `?${s}` : ''}`;
}

// --- workspace-scoped ----------------------------------------------------

export async function listBranchesAction(params: BranchListParams = {}) {
    const response = await apiClient<BranchListResponse>(listQuery('/branches', params), { method: 'GET' });

    if (response.error) {
        return { branches: [] as Branch[], meta: DEFAULT_LIST_META, error: response.error.message };
    }

    const { branches, meta } = normalizeBranchList(response.data);
    return { branches, meta, error: null };
}

export async function getBranchAction(branchId: string) {
    const response = await apiClient<Branch>(`/branches/${branchId}`, { method: 'GET' });

    if (response.error) return { branch: null, error: response.error.message };
    return { branch: response.data ?? null, error: null };
}

export async function createBranchAction(payload: CreateBranchPayload) {
    const response = await apiClient<BranchSecretResult>('/branches', { method: 'POST', body: JSON.stringify(payload) });

    if (response.error) return { result: null, error: response.error.message, code: response.error.code ?? null };
    return { result: response.data ?? null, error: null, code: null };
}

export async function updateBranchAction(branchId: string, payload: UpdateBranchPayload) {
    const response = await apiClient<Branch>(`/branches/${branchId}`, { method: 'PUT', body: JSON.stringify(payload) });

    if (response.error) return { branch: null, error: response.error.message, code: response.error.code ?? null };
    return { branch: response.data ?? null, error: null, code: null };
}

export async function deleteBranchAction(branchId: string) {
    const response = await apiClient<DeleteBranchResponse>(`/branches/${branchId}`, { method: 'DELETE' });

    if (response.error) return { success: false, error: response.error.message };
    return { success: true, error: null };
}

export async function toggleBranchAction(branchId: string, payload: EnableBranchPayload) {
    const response = await apiClient<Branch>(`/branches/${branchId}/enable`, { method: 'PUT', body: JSON.stringify(payload) });

    if (response.error) return { branch: null, error: response.error.message };
    return { branch: response.data ?? null, error: null };
}

export async function rotateBranchSecretAction(branchId: string) {
    const response = await apiClient<BranchSecretResult>(`/branches/${branchId}/rotate-secret`, { method: 'POST' });

    if (response.error) return { result: null, error: response.error.message };
    return { result: response.data ?? null, error: null };
}

// --- deployment SIP endpoint ("where to connect") -------------------------

export async function getBranchSipConfigAction() {
    const response = await apiClient<BranchConnectionInfo>('/branches/sip-config', { method: 'GET' });

    if (response.error) return { config: null, error: response.error.message };
    return { config: response.data ?? null, error: null };
}

// --- member self-service ("Meu Ramal") -----------------------------------

export type DialerRingChannel = 'browser' | 'branch';

export async function getMyRingChannelsAction() {
    const response = await apiClient<{ channels: DialerRingChannel[] }>('/dialer/ring-channels', { method: 'GET' });

    if (response.error) return { channels: [] as DialerRingChannel[], error: response.error.message };
    return { channels: response.data?.channels ?? [], error: null };
}

export async function setMyRingChannelsAction(channels: DialerRingChannel[]) {
    const response = await apiClient<{ channels: DialerRingChannel[] }>('/dialer/ring-channels', {
        method: 'PUT',
        body: JSON.stringify({ channels }),
    });

    if (response.error) return { channels: [] as DialerRingChannel[], error: response.error.message };
    return { channels: response.data?.channels ?? channels, error: null };
}

export async function listMyBranchesAction() {
    const response = await apiClient<{ items?: Branch[] } | Branch[]>('/branches/mine', { method: 'GET' });

    if (response.error) return { branches: [] as Branch[], error: response.error.message };

    const data = response.data;
    const branches = Array.isArray(data) ? data : (data?.items ?? []);
    return { branches, error: null };
}

export async function rotateMyBranchSecretAction(branchId: string) {
    const response = await apiClient<BranchSecretResult>(`/branches/mine/${branchId}/rotate-secret`, { method: 'POST' });

    if (response.error) return { result: null, error: response.error.message };
    return { result: response.data ?? null, error: null };
}

// --- admin ---------------------------------------------------------------

export async function adminListBranchesAction(workspaceId: string, params: BranchListParams = {}) {
    const response = await apiClient<BranchListResponse>(
        listQuery(`/admin/workspaces/${workspaceId}/branches`, params),
        { method: 'GET' },
    );

    if (response.error) {
        return { branches: [] as Branch[], meta: DEFAULT_LIST_META, error: response.error.message };
    }

    const { branches, meta } = normalizeBranchList(response.data);
    return { branches, meta, error: null };
}

export async function adminCreateBranchAction(workspaceId: string, payload: CreateBranchPayload) {
    const response = await apiClient<BranchSecretResult>(`/admin/workspaces/${workspaceId}/branches`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    if (response.error) return { result: null, error: response.error.message };
    return { result: response.data ?? null, error: null };
}

export async function adminGetBranchAction(branchId: string) {
    const response = await apiClient<Branch>(`/admin/branches/${branchId}`, { method: 'GET' });

    if (response.error) return { branch: null, error: response.error.message };
    return { branch: response.data ?? null, error: null };
}

export async function adminUpdateBranchAction(branchId: string, payload: UpdateBranchPayload) {
    const response = await apiClient<Branch>(`/admin/branches/${branchId}`, { method: 'PUT', body: JSON.stringify(payload) });

    if (response.error) return { branch: null, error: response.error.message };
    return { branch: response.data ?? null, error: null };
}

export async function adminDeleteBranchAction(branchId: string) {
    const response = await apiClient<DeleteBranchResponse>(`/admin/branches/${branchId}`, { method: 'DELETE' });

    if (response.error) return { success: false, error: response.error.message };
    return { success: true, error: null };
}

export async function adminToggleBranchAction(branchId: string, payload: EnableBranchPayload) {
    const response = await apiClient<Branch>(`/admin/branches/${branchId}/enable`, { method: 'PUT', body: JSON.stringify(payload) });

    if (response.error) return { branch: null, error: response.error.message };
    return { branch: response.data ?? null, error: null };
}

export async function adminRotateBranchSecretAction(branchId: string) {
    const response = await apiClient<BranchSecretResult>(`/admin/branches/${branchId}/rotate-secret`, { method: 'POST' });

    if (response.error) return { result: null, error: response.error.message };
    return { result: response.data ?? null, error: null };
}
