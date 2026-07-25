import type {
    BuilderSession,
    CreateWorkflowPayload,
    HandleDefinition,
    LintIssue,
    NodeAnalysis,
    NodeDefinition,
    RunDetail,
    RunListResponse,
    StartRunPayload,
    TestNodePayload,
    TestNodeResult,
    UpdateWorkflowPayload,
    Workflow,
    WorkflowGraph,
    WorkflowListMeta,
    WorkflowListResponse,
    WorkflowNodeType,
    WorkflowRun,
} from '@/lib/workflows/types';

import { apiClient } from '@/lib/api/browser-client';

const DEFAULT_META: WorkflowListMeta = {
    page: 1,
    pageSize: 15,
    totalPages: 1,
    totalItems: 0,
};

function unwrapWorkflow(payload?: Workflow | { data?: Workflow } | null): Workflow | null {
    if (
        payload &&
        typeof payload === 'object' &&
        'data' in payload &&
        payload.data
    ) {
        return payload.data;
    }

    return (payload as Workflow) ?? null;
}

function normalizeWorkflowList(payload?: WorkflowListResponse | Workflow[] | null) {
    const meta: WorkflowListMeta = { ...DEFAULT_META };
    let workflows: Workflow[] = [];

    if (!payload) return { workflows, meta };

    if (Array.isArray(payload)) {
        workflows = payload;
    } else {
        if (Array.isArray(payload.data)) {
            workflows = payload.data;
        } else if (Array.isArray(payload.items)) {
            workflows = payload.items;
        }
        if (payload.meta) {
            meta.page = payload.meta.page ?? meta.page;
            meta.pageSize = payload.meta.pageSize ?? meta.pageSize;
            meta.totalPages = payload.meta.totalPages ?? meta.totalPages;
            meta.totalItems = payload.meta.totalItems ?? meta.totalItems;
        }
    }

    if (!meta.totalItems) meta.totalItems = workflows.length;
    return { workflows, meta };
}

function normalizeRunList(payload?: RunListResponse | WorkflowRun[] | null) {
    const meta: WorkflowListMeta = { ...DEFAULT_META };
    let runs: WorkflowRun[] = [];

    if (!payload) return { runs, meta };

    if (Array.isArray(payload)) {
        runs = payload;
    } else {
        if (Array.isArray(payload.data)) {
            runs = payload.data;
        } else if (Array.isArray(payload.items)) {
            runs = payload.items;
        }
        if (payload.meta) {
            meta.page = payload.meta.page ?? meta.page;
            meta.pageSize = payload.meta.pageSize ?? meta.pageSize;
            meta.totalPages = payload.meta.totalPages ?? meta.totalPages;
            meta.totalItems = payload.meta.totalItems ?? meta.totalItems;
        }
    }

    if (!meta.totalItems) meta.totalItems = runs.length;
    return { runs, meta };
}


export async function getNodeTypesAction() {
    const response = await apiClient<NodeDefinition[]>('/workflows/node-types', { method: 'GET' });

    if (response.error) {
        return { definitions: [] as NodeDefinition[], error: response.error.message };
    }
    return { definitions: response.data ?? [] };
}

// resolveHandlesAction asks the backend for each node's output handles (including
// config-dependent ones and their optional flags). The backend is the single
// source of truth, the editor renders what this returns, it does not recompute
// handles or their optional/required status locally.
export async function resolveHandlesAction(
    nodes: Array<{ id: string; type: WorkflowNodeType; config?: Record<string, unknown> }>,
) {
    const empty = {} as Record<string, HandleDefinition[]>;
    const response = await apiClient<{ handles: Record<string, HandleDefinition[]> }>(
        '/workflows/resolve-handles',
        { method: 'POST', body: JSON.stringify({ nodes }) },
    );
    if (response.error) {
        return { handles: empty, error: response.error.message };
    }
    return { handles: response.data?.handles ?? empty };
}

// validateGraphAction runs the full backend lint over a graph and returns the
// structured issues + a `valid` flag (the SAME rules `activate` enforces), so the
// editor can show exactly which nodes/handles are blocking before activation.
export async function validateGraphAction(type: WorkflowNodeType | string, graph: WorkflowGraph) {
    const response = await apiClient<{ valid: boolean; issues: LintIssue[] }>(
        '/workflows/validate',
        { method: 'POST', body: JSON.stringify({ type, graph }) },
    );
    if (response.error) {
        return { valid: false, issues: [] as LintIssue[], error: response.error.message };
    }
    return { valid: response.data?.valid ?? false, issues: response.data?.issues ?? [] };
}


export async function listWorkflowsAction(params?: { page?: number; pageSize?: number; status?: string; search?: string }) {
    const qp = new URLSearchParams();
    if (params?.page) qp.set('page', String(params.page));
    if (params?.pageSize) qp.set('pageSize', String(params.pageSize));
    if (params?.status) qp.set('status', params.status);
    if (params?.search) qp.set('search', params.search);
    const qs = qp.toString();

    const response = await apiClient<WorkflowListResponse>(`/workflows${qs ? `?${qs}` : ''}`, { method: 'GET' });

    if (response.error) {
        return { workflows: [] as Workflow[], meta: DEFAULT_META, error: response.error.message };
    }

    const { workflows, meta } = normalizeWorkflowList(response.data ?? null);
    return { workflows, meta };
}

export async function getWorkflowAction(id: string) {
    const response = await apiClient<Workflow>(`/workflows/${encodeURIComponent(id)}`, { method: 'GET' });

    if (response.error) {
        return { workflow: null as Workflow | null, error: response.error.message };
    }
    return { workflow: response.data ?? null };
}

export async function createWorkflowAction(payload: CreateWorkflowPayload) {
    const response = await apiClient<Workflow>('/workflows', { method: 'POST', body: JSON.stringify(payload) });

    if (response.error) {
        return { workflow: null as Workflow | null, error: response.error.message };
    }
    return { workflow: response.data ?? null };
}

export async function updateWorkflowAction(id: string, payload: UpdateWorkflowPayload) {
    const response = await apiClient<Workflow>(`/workflows/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });

    if (response.error) {
        return { workflow: null as Workflow | null, error: response.error.message };
    }
    return { workflow: response.data ?? null };
}

export async function assignWorkflowDepartmentAction(
    id: string,
    departmentId: string,
) {
    const response = await apiClient<Workflow>(`/workflows/${encodeURIComponent(id)}/department`, {
        method: 'PATCH',
        body: JSON.stringify({ departmentId }),
    });

    if (response.error) {
        return { workflow: null as Workflow | null, error: response.error.message };
    }

    return { workflow: unwrapWorkflow(response.data ?? null), error: null };
}

export async function deleteWorkflowAction(id: string) {
    const response = await apiClient<void>(`/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' });

    if (response.error) {
        return { error: response.error.message };
    }
    return {};
}


export interface WorkflowWebhookConfig {
    id: string;
    workflow_id: string;
    url: string;
    auth_mode: 'none' | 'header_token' | 'hmac';
    secret?: string;
    header_name?: string;
    method: string;
    active: boolean;
}

export interface WorkflowWebhookInput {
    auth_mode?: string;
    header_name?: string;
    method?: string;
    active?: boolean;
}

export async function getWorkflowWebhookAction(workflowId: string) {
    const response = await apiClient<WorkflowWebhookConfig>(
        `/workflows/${encodeURIComponent(workflowId)}/webhook`,
        { method: 'GET' },
    );
    if (response.error) {
        if (response.error.status === 404) {
            return { webhook: null as WorkflowWebhookConfig | null };
        }
        return { webhook: null as WorkflowWebhookConfig | null, error: response.error.message };
    }
    return { webhook: response.data ?? null };
}

export async function createWorkflowWebhookAction(
    workflowId: string,
    payload: WorkflowWebhookInput = {},
) {
    const response = await apiClient<WorkflowWebhookConfig>(
        `/workflows/${encodeURIComponent(workflowId)}/webhook`,
        { method: 'POST', body: JSON.stringify(payload) },
    );
    if (response.error) {
        return { webhook: null as WorkflowWebhookConfig | null, error: response.error.message };
    }
    return { webhook: response.data ?? null };
}

export async function updateWorkflowWebhookAction(
    workflowId: string,
    payload: WorkflowWebhookInput,
) {
    const response = await apiClient<WorkflowWebhookConfig>(
        `/workflows/${encodeURIComponent(workflowId)}/webhook`,
        { method: 'PUT', body: JSON.stringify(payload) },
    );
    if (response.error) {
        return { webhook: null as WorkflowWebhookConfig | null, error: response.error.message };
    }
    return { webhook: response.data ?? null };
}

export async function rotateWorkflowWebhookAction(workflowId: string) {
    const response = await apiClient<WorkflowWebhookConfig>(
        `/workflows/${encodeURIComponent(workflowId)}/webhook/rotate`,
        { method: 'POST' },
    );
    if (response.error) {
        return { webhook: null as WorkflowWebhookConfig | null, error: response.error.message };
    }
    return { webhook: response.data ?? null };
}

export async function deleteWorkflowWebhookAction(workflowId: string) {
    const response = await apiClient<void>(
        `/workflows/${encodeURIComponent(workflowId)}/webhook`,
        { method: 'DELETE' },
    );
    if (response.error) {
        return { error: response.error.message };
    }
    return {};
}

export async function activateWorkflowAction(id: string) {
    const response = await apiClient<Workflow>(`/workflows/${encodeURIComponent(id)}/activate`, { method: 'POST' });

    if (response.error) {
        return { workflow: null as Workflow | null, error: response.error.message };
    }
    return { workflow: response.data ?? null };
}

export async function pauseWorkflowAction(id: string) {
    const response = await apiClient<Workflow>(`/workflows/${encodeURIComponent(id)}/pause`, { method: 'POST' });

    if (response.error) {
        return { workflow: null as Workflow | null, error: response.error.message };
    }
    return { workflow: response.data ?? null };
}


export async function listRunsAction(workflowId: string, params?: { page?: number; pageSize?: number }) {
    const qp = new URLSearchParams();
    if (params?.page) qp.set('page', String(params.page));
    if (params?.pageSize) qp.set('pageSize', String(params.pageSize));
    const qs = qp.toString();

    const response = await apiClient<RunListResponse>(
        `/workflows/${encodeURIComponent(workflowId)}/runs${qs ? `?${qs}` : ''}`,
        { method: 'GET' },
    );

    if (response.error) {
        return { runs: [] as WorkflowRun[], meta: DEFAULT_META, error: response.error.message };
    }

    const { runs, meta } = normalizeRunList(response.data ?? null);
    return { runs, meta };
}

export async function startRunAction(workflowId: string, payload: StartRunPayload) {
    const response = await apiClient<WorkflowRun>(
        `/workflows/${encodeURIComponent(workflowId)}/runs`,
        { method: 'POST', body: JSON.stringify(payload) },
    );

    if (response.error) {
        return { run: null as WorkflowRun | null, error: response.error.message };
    }
    return { run: response.data ?? null };
}

export async function getRunAction(runId: string) {
    const response = await apiClient<RunDetail>(`/workflow-runs/${encodeURIComponent(runId)}`, { method: 'GET' });

    if (response.error) {
        return { detail: null as RunDetail | null, error: response.error.message };
    }
    return { detail: response.data ?? null };
}

export async function cancelRunAction(runId: string) {
    const response = await apiClient<WorkflowRun>(`/workflow-runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' });

    if (response.error) {
        return { run: null as WorkflowRun | null, error: response.error.message };
    }
    return { run: response.data ?? null };
}


export async function listBuilderSessionsAction(workflowId: string) {
    const response = await apiClient<BuilderSession[]>(
        `/workflows/${encodeURIComponent(workflowId)}/builder-sessions`,
        { method: 'GET' },
    );

    if (response.error) {
        return { sessions: [] as BuilderSession[], error: response.error.message };
    }
    return { sessions: response.data ?? [] };
}

export async function getBuilderSessionAction(sessionId: string) {
    const response = await apiClient<BuilderSession>(
        `/builder-sessions/${encodeURIComponent(sessionId)}`,
        { method: 'GET' },
    );

    if (response.error) {
        return { session: null as BuilderSession | null, error: response.error.message };
    }
    return { session: response.data ?? null };
}


export async function importWorkflowAction(jsonPayload: string) {
    const response = await apiClient<Workflow>('/workflows/import', {
        method: 'POST',
        body: jsonPayload,
    });

    if (response.error) {
        return { workflow: null as Workflow | null, error: response.error.message };
    }
    return { workflow: response.data ?? null };
}


export async function analyzeNodeAction(workflowId: string, nodeId: string) {
    const response = await apiClient<NodeAnalysis>(
        `/workflows/${encodeURIComponent(workflowId)}/nodes/${encodeURIComponent(nodeId)}/analyze`,
        { method: 'GET' },
    );

    if (response.error) {
        return { analysis: null as NodeAnalysis | null, error: response.error.message };
    }
    return { analysis: response.data ?? null };
}

export async function testNodeAction(workflowId: string, nodeId: string, payload: TestNodePayload) {
    const response = await apiClient<TestNodeResult>(
        `/workflows/${encodeURIComponent(workflowId)}/nodes/${encodeURIComponent(nodeId)}/test`,
        { method: 'POST', body: JSON.stringify(payload) },
    );

    if (response.error) {
        return { result: null as TestNodeResult | null, error: response.error.message };
    }
    return { result: response.data ?? null };
}
