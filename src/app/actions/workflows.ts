import type { BuilderSession, ConversationWorkflowRun, CreateWorkflowPayload, EntryPointKind, HandleDefinition, LintIssue, NodeAnalysis, NodeDefinition, PagedResponse, RunDetail, RunStatus, RuntimeAlert, TestNodePayload, TestNodeResult, UpdateWorkflowPayload, WebhookDelivery, Workflow, WorkflowGraph, WorkflowListMeta, WorkflowListResponse, WorkflowNodeType, WorkflowRun, WorkflowVersion } from '@/lib/workflows/types';

import { apiClient } from '@/lib/api/browser-client';
import { draftConflictOf, type DraftWriteAnswer } from '@/lib/workflows/draft-save';
import { publishFailureOf, type PublishAnswer } from '@/lib/workflows/publication';
import { runStepsRequest } from '@/lib/workflows/run-steps';

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

export function normalizePage<T>(payload?: PagedResponse<T> | T[] | null): { items: T[]; meta: WorkflowListMeta } {
    const meta: WorkflowListMeta = { ...DEFAULT_META };
    let items: T[] = [];

    if (!payload) return { items, meta };

    if (Array.isArray(payload)) {
        items = payload;
    } else {
        if (Array.isArray(payload.data)) {
            items = payload.data;
        } else if (Array.isArray(payload.items)) {
            items = payload.items;
        }
        if (payload.meta) {
            meta.page = payload.meta.page ?? meta.page;
            meta.pageSize = payload.meta.pageSize ?? meta.pageSize;
            meta.totalPages = payload.meta.totalPages ?? meta.totalPages;
            meta.totalItems = payload.meta.totalItems ?? meta.totalItems;
        }
    }

    if (!meta.totalItems) meta.totalItems = items.length;
    return { items, meta };
}

function draftWriteAnswer(response: Awaited<ReturnType<typeof apiClient<Workflow>>>): DraftWriteAnswer {
    if (!response.error) return { workflow: response.data ?? null };
    const { message, code, status } = response.error;
    const conflict = draftConflictOf(response.error);
    return {
        workflow: null,
        error: message,
        ...(code ? { code } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(conflict ? { conflict } : {}),
    };
}

function normalizeWorkflowList(payload?: WorkflowListResponse | Workflow[] | null) {
    const { items, meta } = normalizePage(payload);
    return { workflows: items, meta };
}

function pageQuery(params: Record<string, string | number | undefined>): string {
    const qp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') qp.set(key, String(value));
    }
    const qs = qp.toString();
    return qs ? `?${qs}` : '';
}


export async function getNodeTypesAction() {
    const response = await apiClient<NodeDefinition[]>('/workflows/node-types', { method: 'GET' });

    if (response.error) {
        return { definitions: [] as NodeDefinition[], error: response.error.message, code: response.error.code, status: response.error.status };
    }
    return { definitions: response.data ?? [] };
}

export async function resolveHandlesAction(
    nodes: Array<{ id: string; type: WorkflowNodeType; config?: Record<string, unknown> }>,
) {
    const empty = {} as Record<string, HandleDefinition[]>;
    const response = await apiClient<{ handles: Record<string, HandleDefinition[]> }>(
        '/workflows/resolve-handles',
        { method: 'POST', body: JSON.stringify({ nodes }) },
    );
    if (response.error) {
        return { handles: empty, error: response.error.message, code: response.error.code, status: response.error.status };
    }
    return { handles: response.data?.handles ?? empty };
}

export async function validateGraphAction(type: WorkflowNodeType | string, graph: WorkflowGraph) {
    const response = await apiClient<{ valid: boolean; issues: LintIssue[] }>(
        '/workflows/validate',
        { method: 'POST', body: JSON.stringify({ type, graph }) },
    );
    if (response.error) {
        return { valid: false, issues: [] as LintIssue[], error: response.error.message, code: response.error.code, status: response.error.status };
    }
    return { valid: response.data?.valid ?? false, issues: response.data?.issues ?? [] };
}


export async function listWorkflowsAction(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
    type?: string;
    triggerType?: string;
    entryKind?: EntryPointKind;
}) {
    const qp = new URLSearchParams();
    if (params?.page) qp.set('page', String(params.page));
    if (params?.pageSize) qp.set('pageSize', String(params.pageSize));
    if (params?.status) qp.set('status', params.status);
    if (params?.search) qp.set('search', params.search);
    if (params?.type) qp.set('type', params.type);
    if (params?.triggerType) qp.set('triggerType', params.triggerType);
    if (params?.entryKind) qp.set('entryKind', params.entryKind);
    const qs = qp.toString();

    const response = await apiClient<WorkflowListResponse>(`/workflows${qs ? `?${qs}` : ''}`, { method: 'GET' });

    if (response.error) {
        return { workflows: [] as Workflow[], meta: DEFAULT_META, error: response.error.message, code: response.error.code, status: response.error.status };
    }

    const { workflows, meta } = normalizeWorkflowList(response.data ?? null);
    return { workflows, meta };
}

export async function getWorkflowAction(id: string) {
    const response = await apiClient<Workflow>(`/workflows/${encodeURIComponent(id)}`, { method: 'GET' });

    if (response.error) {
        return { workflow: null as Workflow | null, error: response.error.message, code: response.error.code, status: response.error.status };
    }
    return { workflow: response.data ?? null };
}

export async function createWorkflowAction(payload: CreateWorkflowPayload): Promise<DraftWriteAnswer> {
    return draftWriteAnswer(await apiClient<Workflow>('/workflows', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function updateWorkflowAction(id: string, payload: UpdateWorkflowPayload): Promise<DraftWriteAnswer> {
    return draftWriteAnswer(
        await apiClient<Workflow>(`/workflows/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        }),
    );
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
        return { workflow: null as Workflow | null, error: response.error.message, code: response.error.code, status: response.error.status };
    }

    return { workflow: unwrapWorkflow(response.data ?? null), error: null };
}

export async function deleteWorkflowAction(id: string) {
    const response = await apiClient<void>(`/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' });

    if (response.error) {
        return { error: response.error.message, code: response.error.code, status: response.error.status };
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

interface WorkflowWebhookInput {
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
        return { webhook: null as WorkflowWebhookConfig | null, error: response.error.message, code: response.error.code, status: response.error.status };
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
        return { webhook: null as WorkflowWebhookConfig | null, error: response.error.message, code: response.error.code, status: response.error.status };
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
        return { webhook: null as WorkflowWebhookConfig | null, error: response.error.message, code: response.error.code, status: response.error.status };
    }
    return { webhook: response.data ?? null };
}

export async function rotateWorkflowWebhookAction(workflowId: string) {
    const response = await apiClient<WorkflowWebhookConfig>(
        `/workflows/${encodeURIComponent(workflowId)}/webhook/rotate`,
        { method: 'POST' },
    );
    if (response.error) {
        return { webhook: null as WorkflowWebhookConfig | null, error: response.error.message, code: response.error.code, status: response.error.status };
    }
    return { webhook: response.data ?? null };
}

export async function deleteWorkflowWebhookAction(workflowId: string) {
    const response = await apiClient<void>(
        `/workflows/${encodeURIComponent(workflowId)}/webhook`,
        { method: 'DELETE' },
    );
    if (response.error) {
        return { error: response.error.message, code: response.error.code, status: response.error.status };
    }
    return {};
}

export async function listWorkflowWebhookDeliveriesAction(
    workflowId: string,
    params: { page?: number; pageSize?: number } = {},
) {
    const response = await apiClient<PagedResponse<WebhookDelivery>>(
        `/workflows/${encodeURIComponent(workflowId)}/webhook/deliveries${pageQuery(params)}`,
        { method: 'GET' },
    );
    if (response.error) {
        return { deliveries: [] as WebhookDelivery[], meta: DEFAULT_META, error: response.error.message, code: response.error.code, status: response.error.status };
    }
    const { items, meta } = normalizePage(response.data ?? null);
    return { deliveries: items, meta };
}

export interface ListWorkflowRunsParams {
    page?: number;
    pageSize?: number;
    status?: RunStatus;
    entryId?: string;
}

export async function listWorkflowRunsAction(workflowId: string, params: ListWorkflowRunsParams = {}) {
    const response = await apiClient<PagedResponse<WorkflowRun>>(
        `/workflows/${encodeURIComponent(workflowId)}/runs${pageQuery({ ...params })}`,
        { method: 'GET' },
    );
    if (response.error) {
        return { runs: [] as WorkflowRun[], meta: DEFAULT_META, error: response.error.message, code: response.error.code, status: response.error.status };
    }
    const { items, meta } = normalizePage(response.data ?? null);
    return { runs: items, meta };
}

export async function getWorkflowRunAction(runId: string, page = 1) {
    const response = await apiClient<RunDetail>(
        `/workflow-runs/${encodeURIComponent(runId)}${pageQuery(runStepsRequest(page))}`,
        { method: 'GET' },
    );
    if (response.error) {
        return { detail: null as RunDetail | null, error: response.error.message, code: response.error.code, status: response.error.status };
    }
    const detail = response.data ?? null;
    if (!detail?.run) {
        return { detail: null as RunDetail | null, error: 'empty run detail' };
    }
    return { detail: { run: detail.run, logs: detail.logs ?? [], ...(detail.steps ? { steps: detail.steps } : {}) } };
}

export async function listConversationWorkflowRunsAction(
    entryType: string,
    entryId: string,
    params: { page?: number; pageSize?: number } = {},
) {
    const response = await apiClient<PagedResponse<ConversationWorkflowRun>>(
        `/conversations/${encodeURIComponent(entryType)}/${encodeURIComponent(entryId)}/workflow-runs${pageQuery(params)}`,
        { method: 'GET' },
    );
    if (response.error) {
        return { runs: [] as ConversationWorkflowRun[], meta: DEFAULT_META, error: response.error.message, code: response.error.code, status: response.error.status };
    }
    const { items, meta } = normalizePage(response.data ?? null);
    return { runs: items, meta };
}

export async function listWorkflowAlertsAction(workflowId: string) {
    const response = await apiClient<{ items?: RuntimeAlert[] }>(
        `/workflows/${encodeURIComponent(workflowId)}/alerts`,
        { method: 'GET' },
    );
    if (response.error) {
        return { alerts: [] as RuntimeAlert[], error: response.error.message, code: response.error.code, status: response.error.status };
    }
    return { alerts: response.data?.items ?? [] };
}

export async function cancelWorkflowRunAction(runId: string) {
    const response = await apiClient<{ status: string }>(`/workflow-runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' });
    if (response.error) {
        return { error: response.error.message, code: response.error.code, status: response.error.status };
    }
    return {};
}

export async function activateWorkflowAction(id: string) {
    const response = await apiClient<Workflow>(`/workflows/${encodeURIComponent(id)}/activate`, { method: 'POST' });

    if (response.error) {
        return {
            workflow: null as Workflow | null,
            error: response.error.message,
            code: response.error.code,
            failure: publishFailureOf(response.error),
        };
    }
    return { workflow: response.data ?? null };
}

export async function publishWorkflowAction(id: string): Promise<PublishAnswer> {
    const response = await apiClient<Workflow>(`/workflows/${encodeURIComponent(id)}/publish`, { method: 'POST' });

    if (response.error) {
        return { workflow: null, failure: publishFailureOf(response.error) };
    }
    return { workflow: response.data ?? null };
}

export async function listWorkflowVersionsAction(id: string, params: { page?: number; pageSize?: number } = {}) {
    const response = await apiClient<PagedResponse<WorkflowVersion>>(
        `/workflows/${encodeURIComponent(id)}/versions${pageQuery(params)}`,
        { method: 'GET' },
    );
    if (response.error) {
        return { versions: [] as WorkflowVersion[], meta: DEFAULT_META, error: response.error.message, code: response.error.code, status: response.error.status };
    }
    const { items, meta } = normalizePage(response.data ?? null);
    return { versions: items, meta };
}

export async function getWorkflowVersionAction(id: string, version: number) {
    const response = await apiClient<WorkflowVersion>(
        `/workflows/${encodeURIComponent(id)}/versions/${encodeURIComponent(String(version))}`,
        { method: 'GET' },
    );
    if (response.error) {
        return { version: null as WorkflowVersion | null, error: response.error.message, code: response.error.code, status: response.error.status };
    }
    const found = response.data ?? null;
    if (!found?.graph) {
        return { version: null as WorkflowVersion | null, error: 'version without graph' };
    }
    return { version: found };
}

export async function pinNodeFromRunAction(
    workflowId: string,
    nodeId: string,
    pin: { runId: string; stepId?: string; revision: number },
): Promise<DraftWriteAnswer> {
    const body = pin.stepId ? { runId: pin.runId, stepId: pin.stepId, revision: pin.revision } : { runId: pin.runId, revision: pin.revision };
    return draftWriteAnswer(
        await apiClient<Workflow>(
            `/workflows/${encodeURIComponent(workflowId)}/nodes/${encodeURIComponent(nodeId)}/pin-from-run`,
            { method: 'POST', body: JSON.stringify(body) },
        ),
    );
}

export async function restoreWorkflowVersionAction(id: string, version: number, revision: number): Promise<DraftWriteAnswer> {
    return draftWriteAnswer(
        await apiClient<Workflow>(
            `/workflows/${encodeURIComponent(id)}/versions/${encodeURIComponent(String(version))}/restore`,
            { method: 'POST', body: JSON.stringify({ revision }) },
        ),
    );
}

export async function pauseWorkflowAction(id: string) {
    const response = await apiClient<Workflow>(`/workflows/${encodeURIComponent(id)}/pause`, { method: 'POST' });

    if (response.error) {
        return { workflow: null as Workflow | null, error: response.error.message, code: response.error.code, status: response.error.status };
    }
    return { workflow: response.data ?? null };
}


export async function listBuilderSessionsAction(workflowId: string) {
    const response = await apiClient<BuilderSession[]>(
        `/workflows/${encodeURIComponent(workflowId)}/builder-sessions`,
        { method: 'GET' },
    );

    if (response.error) {
        return { sessions: [] as BuilderSession[], error: response.error.message, code: response.error.code, status: response.error.status };
    }
    return { sessions: response.data ?? [] };
}

export async function getBuilderSessionAction(sessionId: string) {
    const response = await apiClient<BuilderSession>(
        `/builder-sessions/${encodeURIComponent(sessionId)}`,
        { method: 'GET' },
    );

    if (response.error) {
        return { session: null as BuilderSession | null, error: response.error.message, code: response.error.code, status: response.error.status };
    }
    return { session: response.data ?? null };
}


export async function importWorkflowAction(jsonPayload: string) {
    const response = await apiClient<Workflow>('/workflows/import', {
        method: 'POST',
        body: jsonPayload,
    });

    if (response.error) {
        return { workflow: null as Workflow | null, error: response.error.message, code: response.error.code, status: response.error.status };
    }
    return { workflow: response.data ?? null };
}


export async function analyzeNodeAction(workflowId: string, nodeId: string) {
    const response = await apiClient<NodeAnalysis>(
        `/workflows/${encodeURIComponent(workflowId)}/nodes/${encodeURIComponent(nodeId)}/analyze`,
        { method: 'GET' },
    );

    if (response.error) {
        return { analysis: null as NodeAnalysis | null, error: response.error.message, code: response.error.code, status: response.error.status };
    }
    return { analysis: response.data ?? null };
}

export async function testNodeAction(workflowId: string, nodeId: string, payload: TestNodePayload) {
    const response = await apiClient<TestNodeResult>(
        `/workflows/${encodeURIComponent(workflowId)}/nodes/${encodeURIComponent(nodeId)}/test`,
        { method: 'POST', body: JSON.stringify(payload) },
    );

    if (response.error) {
        return { result: null as TestNodeResult | null, error: response.error.message, code: response.error.code, status: response.error.status };
    }
    return { result: response.data ?? null };
}
