import type {
  Agent,
  AgentListItem,
  AgentListMeta,
  AgentListParams,
  AgentListResponse,
  AgentOptions,
  AgentToolDefinition,
  AgentVariableInfo,
  CreateAgentPayload,
  UpdateAgentPayload,
} from '@/lib/agents/types';

import { apiClient } from '@/lib/api/browser-client';

const DEFAULT_AGENT_META: AgentListMeta = {
  page: 1,
  pageSize: 0,
  totalPages: 1,
  totalItems: 0,
};

function unwrapAgent(payload?: Agent | { data?: Agent } | null): Agent | null {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    payload.data
  ) {
    return payload.data;
  }

  return (payload as Agent) ?? null;
}

function normalizeAgentList(payload?: AgentListResponse | AgentListItem[] | null) {
  const meta: AgentListMeta = { ...DEFAULT_AGENT_META };
  let agents: AgentListItem[] = [];

  if (!payload) {
    return { agents, meta };
  }

  if (Array.isArray(payload)) {
    agents = payload;
  } else {
    if (Array.isArray(payload.data)) {
      agents = payload.data as AgentListItem[];
    } else if (Array.isArray(payload.items)) {
      agents = payload.items as AgentListItem[];
    } else if (Array.isArray(payload.agents)) {
      agents = payload.agents as AgentListItem[];
    }

    if (payload.meta) {
      meta.page = payload.meta.page ?? meta.page;
      meta.pageSize = payload.meta.pageSize ?? meta.pageSize;
      meta.totalPages = payload.meta.totalPages ?? meta.totalPages;
      meta.totalItems = payload.meta.totalItems ?? meta.totalItems;
    }
  }

  if (!meta.pageSize) {
    meta.pageSize = agents.length;
  }

  if (!meta.totalItems) {
    meta.totalItems = agents.length;
  }

  return { agents, meta };
}

export async function listAgentsAction(params?: AgentListParams) {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', String(params.page));
  if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));
  if (params?.search) queryParams.set('search', params.search);
  if (params?.sort) queryParams.set('sort', params.sort);
  const queryString = queryParams.toString();
  const endpoint = `/agents${queryString ? `?${queryString}` : ''}`;

  const response = await apiClient<AgentListResponse>(endpoint, {
    method: 'GET',
  });

  if (response.error) {
    return {
      agents: [] as AgentListItem[],
      meta: DEFAULT_AGENT_META,
      error: response.error.message,
    };
  }

  const { agents, meta } = normalizeAgentList(response.data ?? null);

  return { agents, meta };
}

export async function getAgentByIdAction(agentId: string) {
  const response = await apiClient<Agent>(`/agents/${agentId}`, {
    method: 'GET',
  });
  if (response.error) {
    return { agent: null, error: response.error.message };
  }
  return { agent: response.data ?? null };
}

export async function createAgentAction(agentData: CreateAgentPayload) {
  const response = await apiClient<Agent>('/agents', {
    method: 'POST',
    body: JSON.stringify(agentData),
  });
  if (response.error) {
    return { agent: null, error: response.error.message, errorCode: response.error.code ?? null };
  }

  return { agent: response.data ?? null, error: null, errorCode: null };
}

export async function updateAgentAction(agentId: string, agentData: UpdateAgentPayload) {
  const response = await apiClient<Agent>(`/agents/${agentId}`, {
    method: 'PUT',
    body: JSON.stringify(agentData),
  });

  console.log(response)
  if (response.error) {
    return { agent: null, error: response.error.message, errorCode: response.error.code ?? null };
  }

  return { agent: unwrapAgent(response.data ?? null), error: null, errorCode: null };
}

export async function assignAgentDepartmentAction(
  agentId: string,
  departmentId: string,
) {
  const response = await apiClient<Agent>(`/agents/${agentId}/department`, {
    method: 'PATCH',
    body: JSON.stringify({ departmentId }),
  });

  if (response.error) {
    return { agent: null, error: response.error.message };
  }

  return { agent: response.data ?? null, error: null };
}

export async function getAgentOptionsAction() {
  const response = await apiClient<AgentOptions>('/agents/options', {
    method: 'GET',
  });

  if (response.error) {
    return { options: null, error: response.error.message };
  }

  return { options: response.data ?? null, error: null };
}

export async function getAgentToolsAction() {
  const response = await apiClient<AgentToolDefinition[]>('/agents/tools', {
    method: 'GET',
  });

  if (response.error) {
    return { tools: [] as AgentToolDefinition[], error: response.error.message };
  }

  return { tools: response.data ?? [], error: null };
}

export async function toggleAgentStatusAction(agentId: string, isActive: boolean) {
  const response = await apiClient<Agent>(`/agents/${agentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });

  if (response.error) {
    return { success: false, error: response.error.message };
  }

  return { success: true, error: null };
}

export async function listArchivedAgentsAction() {
  const response = await apiClient<AgentListResponse>('/agents/archived', {
    method: 'GET',
  });

  if (response.error) {
    return {
      agents: [] as AgentListItem[],
      meta: DEFAULT_AGENT_META,
      error: response.error.message,
    };
  }

  const { agents, meta } = normalizeAgentList(response.data ?? null);

  return { agents, meta };
}

export async function archiveAgentAction(agentId: string) {
  const response = await apiClient<Agent>(`/agents/${agentId}/archive`, {
    method: 'PATCH',
  });

  if (response.error) {
    return { success: false, error: response.error.message };
  }

  return { success: true, error: null };
}

export async function getAgentRequiredVariablesAction(agentId: string) {
  const response = await apiClient<AgentVariableInfo[]>(`/agents/${agentId}/required-variables`, {
    method: 'GET',
  });
  if (response.error) {
    return { variables: null, error: response.error.message };
  }
  return { variables: response.data ?? [], error: null };
}

export async function unarchiveAgentAction(agentId: string) {
  const response = await apiClient<Agent>(`/agents/${agentId}/unarchive`, {
    method: 'PATCH',
  });

  if (response.error) {
    return { success: false, error: response.error.message };
  }

  return { success: true, error: null };
}