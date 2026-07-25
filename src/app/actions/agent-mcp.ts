import type {
    AgentMCPBuiltinBinding,
    AgentMCPCatalogEntry,
    AgentMCPCollection,
    AgentMCPRemoteServer,
    CollectionInput,
    RegisterRemoteInput,
    StartOAuthOutput,
} from '@/lib/agent-mcp/types';

import { apiClient } from "@/lib/api/browser-client";

const BASE = '/mcp';

function unwrapList<T>(payload: unknown, key: string): T[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload as T[];
    if (typeof payload === 'object' && payload !== null) {
        const obj = payload as Record<string, unknown>;
        const arr = obj[key];
        if (Array.isArray(arr)) return arr as T[];
        if (Array.isArray(obj.items)) return obj.items as T[];
        if (Array.isArray(obj.data)) return obj.data as T[];
    }
    return [];
}


export async function listMCPCatalogAction() {
    const res = await apiClient<unknown>(`${BASE}/catalog`, { method: 'GET' });
    if (res.error) return { items: [] as AgentMCPCatalogEntry[], error: res.error.message };
    return { items: unwrapList<AgentMCPCatalogEntry>(res.data, 'items') };
}

export async function listMCPBindingsAction() {
    const res = await apiClient<unknown>(`${BASE}/bindings`, { method: 'GET' });
    if (res.error) return { items: [] as AgentMCPBuiltinBinding[], error: res.error.message };
    return { items: unwrapList<AgentMCPBuiltinBinding>(res.data, 'items') };
}

export interface CreateMCPBindingInput {
    serverKey: string;
    label?: string;
    apiKey?: string;
}

export async function createMCPBindingAction(input: CreateMCPBindingInput) {
    const body: Record<string, unknown> = { serverKey: input.serverKey };
    if (input.label) body.label = input.label;
    if (input.apiKey) body.apiKey = input.apiKey;
    const res = await apiClient<AgentMCPBuiltinBinding>(`${BASE}/bindings`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
    if (res.error) return { binding: null as AgentMCPBuiltinBinding | null, error: res.error.message };
    return { binding: res.data ?? null };
}

export async function enableMCPBuiltinAction(serverKey: string) {
    return createMCPBindingAction({ serverKey });
}

export async function configureMCPAPIKeyAction(bindingId: string, apiKey: string) {
    const res = await apiClient<AgentMCPBuiltinBinding>(
        `${BASE}/bindings/${encodeURIComponent(bindingId)}/api-key`,
        { method: 'PUT', body: JSON.stringify({ apiKey }) },
    );
    if (res.error) return { binding: null as AgentMCPBuiltinBinding | null, error: res.error.message };
    return { binding: res.data ?? null };
}

export async function deleteMCPBindingAction(bindingId: string) {
    const res = await apiClient<unknown>(
        `${BASE}/bindings/${encodeURIComponent(bindingId)}`,
        { method: 'DELETE' },
    );
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true };
}

export async function startMCPOAuthAction(bindingId: string) {
    const res = await apiClient<StartOAuthOutput>(
        `${BASE}/bindings/${encodeURIComponent(bindingId)}/oauth/start`,
        { method: 'POST' },
    );
    if (res.error) return { authorizeUrl: '', error: res.error.message };
    return { authorizeUrl: res.data?.authorizeUrl ?? '' };
}


export async function listMCPRemotesAction() {
    const res = await apiClient<unknown>(`${BASE}/remote`, { method: 'GET' });
    if (res.error) return { items: [] as AgentMCPRemoteServer[], error: res.error.message };
    return { items: unwrapList<AgentMCPRemoteServer>(res.data, 'items') };
}

export async function registerMCPRemoteAction(input: RegisterRemoteInput) {
    const body: Record<string, unknown> = {
        name: input.name,
        url: input.url,
        authMode: input.authMode,
    };
    if (input.authMode === 'api_key' && input.apiKey) {
        body.apiKey = input.apiKey;
    }
    type Resp = { server: AgentMCPRemoteServer; authorizeUrl?: string };
    const res = await apiClient<Resp>(`${BASE}/remote`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
    if (res.error) {
        return {
            server: null as AgentMCPRemoteServer | null,
            authorizeUrl: '',
            error: res.error.message,
        };
    }
    return {
        server: res.data?.server ?? null,
        authorizeUrl: res.data?.authorizeUrl ?? '',
    };
}

export async function startMCPRemoteOAuthAction(remoteId: string) {
    const res = await apiClient<StartOAuthOutput>(
        `${BASE}/remote/${encodeURIComponent(remoteId)}/oauth/start`,
        { method: 'POST' },
    );
    if (res.error) return { authorizeUrl: '', error: res.error.message };
    return { authorizeUrl: res.data?.authorizeUrl ?? '' };
}

export async function deleteMCPRemoteAction(id: string) {
    const res = await apiClient<unknown>(
        `${BASE}/remote/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
    );
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true };
}


export async function listMCPCollectionsAction() {
    const res = await apiClient<unknown>(`${BASE}/collections`, { method: 'GET' });
    if (res.error) return { items: [] as AgentMCPCollection[], error: res.error.message };
    return { items: unwrapList<AgentMCPCollection>(res.data, 'items') };
}

export async function getMCPCollectionAction(id: string) {
    const res = await apiClient<AgentMCPCollection>(`${BASE}/collections/${encodeURIComponent(id)}`, { method: 'GET' });
    if (res.error) return { collection: null as AgentMCPCollection | null, error: res.error.message };
    return { collection: res.data ?? null };
}

export async function createMCPCollectionAction(input: CollectionInput) {
    const res = await apiClient<AgentMCPCollection>(`${BASE}/collections`, {
        method: 'POST',
        body: JSON.stringify(input),
    });
    if (res.error) return { collection: null as AgentMCPCollection | null, error: res.error.message };
    return { collection: res.data ?? null };
}

export async function updateMCPCollectionAction(id: string, input: CollectionInput) {
    const res = await apiClient<AgentMCPCollection>(`${BASE}/collections/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
    });
    if (res.error) return { collection: null as AgentMCPCollection | null, error: res.error.message };
    return { collection: res.data ?? null };
}

export async function deleteMCPCollectionAction(id: string) {
    const res = await apiClient<unknown>(`${BASE}/collections/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true };
}
