import type {
    ConnectMode,
    UnofficialWhatsAppAllowance,
    GroupParticipantAction,
    LinkChallenge,
    UnofficialWhatsAppGroup,
    UnofficialWhatsAppInstance,
    UnofficialWhatsAppListMeta,
    UpdateGroupPayload,
    UpdateInstancePayload,
    StartedConversation,
} from '@/lib/unofficial-whatsapp/types';
import { DESTRUCTIVE_GROUP_ACTIONS } from '@/lib/unofficial-whatsapp/types';

import { apiClient } from '@/lib/api/browser-client';

const BASE = '/unofficial-whatsapp';

const DEFAULT_META: UnofficialWhatsAppListMeta = {
    page: 1,
    pageSize: 15,
    totalPages: 1,
    totalItems: 0,
};

interface ListApiResponse {
    data: UnofficialWhatsAppInstance[];
    meta: UnofficialWhatsAppListMeta;
}


export async function listInstancesAction(page = 1, pageSize = 15, search?: string) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set('search', search);

    const response = await apiClient<ListApiResponse>(`${BASE}/instances?${params}`, {
        method: 'GET',
    });
    if (response.error) {
        return {
            instances: [] as UnofficialWhatsAppInstance[],
            meta: DEFAULT_META,
            error: response.error.message,
        };
    }
    return {
        instances: response.data?.data ?? [],
        meta: response.data?.meta ?? DEFAULT_META,
    };
}

export async function getInstanceAction(instanceId: string) {
    const response = await apiClient<UnofficialWhatsAppInstance>(`${BASE}/instances/${instanceId}`, {
        method: 'GET',
    });
    if (response.error) return { error: response.error.message };
    return { instance: response.data };
}

export async function provisionInstanceAction(payload: {
    displayName?: string;
    departmentId?: string | null;
}) {
    const response = await apiClient<UnofficialWhatsAppInstance>(`${BASE}/instances`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    if (response.error) return { error: response.error.message };
    return { instance: response.data };
}

export async function updateInstanceAction(instanceId: string, payload: UpdateInstancePayload) {
    const response = await apiClient<UnofficialWhatsAppInstance>(`${BASE}/instances/${instanceId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    if (response.error) return { error: response.error.message };
    return { instance: response.data };
}

export async function deleteInstanceAction(instanceId: string) {
    const response = await apiClient<{ status: string }>(`${BASE}/instances/${instanceId}`, {
        method: 'DELETE',
    });
    if (response.error) return { error: response.error.message };
    return { success: true };
}

export async function connectInstanceAction(
    instanceId: string,
    payload: { mode: ConnectMode; phone?: string },
) {
    const response = await apiClient<LinkChallenge>(`${BASE}/instances/${instanceId}/connect`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    if (response.error) return { error: response.error.message };
    return { challenge: response.data };
}

export async function linkStatusAction(instanceId: string) {
    const response = await apiClient<LinkChallenge>(`${BASE}/instances/${instanceId}/link-status`, {
        method: 'GET',
    });
    if (response.error) return { error: response.error.message };
    return { challenge: response.data };
}

export async function disconnectInstanceAction(instanceId: string) {
    const response = await apiClient<{ status: string }>(
        `${BASE}/instances/${instanceId}/disconnect`,
        { method: 'POST' },
    );
    if (response.error) return { error: response.error.message };
    return { success: true };
}

export async function resetInstanceAction(instanceId: string) {
    const response = await apiClient<{ status: string }>(`${BASE}/instances/${instanceId}/reset`, {
        method: 'POST',
    });
    if (response.error) return { error: response.error.message };
    return { success: true };
}

export async function rotateWebhookTokenAction(instanceId: string) {
    const response = await apiClient<UnofficialWhatsAppInstance>(
        `${BASE}/instances/${instanceId}/webhook/rotate`,
        { method: 'POST' },
    );
    if (response.error) return { error: response.error.message };
    return { instance: response.data };
}

export async function startConversationAction(
    instanceId: string,
    payload: { phoneNumber: string; name?: string },
) {
    const response = await apiClient<StartedConversation>(
        `${BASE}/instances/${instanceId}/conversations`,
        { method: 'POST', body: JSON.stringify(payload) },
    );
    if (response.error) return { error: response.error.message };
    return { conversation: response.data };
}


function groupPath(instanceId: string, groupJid: string, suffix = '') {
    return `${BASE}/instances/${instanceId}/groups/${encodeURIComponent(groupJid)}${suffix}`;
}

function conversationGroupPath(entryId: string, suffix = '') {
    return `${BASE}/conversations/${encodeURIComponent(entryId)}/group${suffix}`;
}

export async function listGroupsAction(instanceId: string) {
    const response = await apiClient<UnofficialWhatsAppGroup[]>(
        `${BASE}/instances/${instanceId}/groups`,
        { method: 'GET' },
    );
    if (response.error) return { groups: [] as UnofficialWhatsAppGroup[], error: response.error.message };
    return { groups: response.data ?? [] };
}

export async function getGroupAction(instanceId: string, groupJid: string, refresh = false) {
    const response = await apiClient<UnofficialWhatsAppGroup>(
        groupPath(instanceId, groupJid, refresh ? '?refresh=true' : ''),
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return { group: response.data };
}

export async function getGroupInviteLinkAction(instanceId: string, groupJid: string) {
    const response = await apiClient<{ inviteLink: string }>(
        groupPath(instanceId, groupJid, '/invite-link'),
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return { inviteLink: response.data?.inviteLink ?? '' };
}

export async function updateGroupAction(
    instanceId: string,
    groupJid: string,
    payload: UpdateGroupPayload,
) {
    const response = await apiClient<UnofficialWhatsAppGroup>(groupPath(instanceId, groupJid), {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
    if (response.error) return { error: response.error.message };
    return { group: response.data };
}

export async function updateGroupParticipantsAction(
    instanceId: string,
    groupJid: string,
    action: GroupParticipantAction,
    participants: string[],
) {
    const destructive = DESTRUCTIVE_GROUP_ACTIONS.includes(action);
    const response = await apiClient<UnofficialWhatsAppGroup>(
        groupPath(instanceId, groupJid, '/participants'),
        {
            method: destructive ? 'DELETE' : 'POST',
            body: JSON.stringify({ action, participants }),
        },
    );
    if (response.error) return { error: response.error.message };
    return { group: response.data };
}

export async function leaveGroupAction(instanceId: string, groupJid: string) {
    const response = await apiClient<{ left: boolean }>(
        groupPath(instanceId, groupJid, '/leave'),
        { method: 'POST' },
    );
    if (response.error) return { error: response.error.message };
    return { success: true };
}


export async function getConversationGroupAction(entryId: string, refresh = false) {
    const response = await apiClient<UnofficialWhatsAppGroup>(
        conversationGroupPath(entryId, refresh ? '?refresh=true' : ''),
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return { group: response.data };
}

export async function getConversationGroupInviteLinkAction(entryId: string) {
    const response = await apiClient<{ inviteLink: string }>(
        conversationGroupPath(entryId, '/invite-link'),
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return { inviteLink: response.data?.inviteLink ?? '' };
}

export async function updateConversationGroupAction(
    entryId: string,
    payload: UpdateGroupPayload,
) {
    const response = await apiClient<UnofficialWhatsAppGroup>(conversationGroupPath(entryId), {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
    if (response.error) return { error: response.error.message };
    return { group: response.data };
}

export async function updateConversationGroupParticipantsAction(
    entryId: string,
    action: GroupParticipantAction,
    participants: string[],
) {
    const destructive = DESTRUCTIVE_GROUP_ACTIONS.includes(action);
    const response = await apiClient<UnofficialWhatsAppGroup>(
        conversationGroupPath(entryId, '/participants'),
        {
            method: destructive ? 'DELETE' : 'POST',
            body: JSON.stringify({ action, participants }),
        },
    );
    if (response.error) return { error: response.error.message };
    return { group: response.data };
}

export async function leaveConversationGroupAction(entryId: string) {
    const response = await apiClient<{ left: boolean }>(
        conversationGroupPath(entryId, '/leave'),
        { method: 'POST' },
    );
    if (response.error) return { error: response.error.message };
    return { success: true };
}



export async function getInstanceAllowanceAction() {
    const response = await apiClient<UnofficialWhatsAppAllowance>(`${BASE}/instances/allowance`, {
        method: 'GET',
    });
    if (response.error) return { error: response.error.message };
    return { allowance: response.data };
}
