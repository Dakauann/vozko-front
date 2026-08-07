import type {
    ConnectMode,
    LinkChallenge,
    UnofficialWhatsAppInstance,
    UnofficialWhatsAppListMeta,
    UpdateInstancePayload,
    StartedConversation,
} from '@/lib/unofficial-whatsapp/types';

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

// ---------------------------------------------------------------- instances

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

/**
 * Provisions a number slot on a host.
 *
 * Deliberately does NOT start the linking attempt. Provisioning talks to a host
 * with an admin credential and can fail on capacity; linking is a user-paced
 * flow the customer drives from their own phone. Collapsing them would make a
 * capacity failure and an expired QR arrive through the same call and read the
 * same way to the operator.
 */
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

/** Asks the host for a QR code or a pairing code. */
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

/**
 * Polls the host while a code is on screen.
 *
 * The code ROTATES, so this is a read of the current one rather than a check on
 * a cached value. It is also what turns "the customer scanned it" into a
 * connected row, so the connect screen calls it on a timer.
 */
export async function linkStatusAction(instanceId: string) {
    const response = await apiClient<LinkChallenge>(`${BASE}/instances/${instanceId}/link-status`, {
        method: 'GET',
    });
    if (response.error) return { error: response.error.message };
    return { challenge: response.data };
}

/** Ends the session without removing the slot, so it can be relinked. */
export async function disconnectInstanceAction(instanceId: string) {
    const response = await apiClient<{ status: string }>(
        `${BASE}/instances/${instanceId}/disconnect`,
        { method: 'POST' },
    );
    if (response.error) return { error: response.error.message };
    return { success: true };
}

/**
 * Restarts a wedged runtime on the host.
 *
 * The host enforces a cooldown and refuses inside it. That refusal is a normal
 * answer rather than a fault, and the screen says so.
 */
export async function resetInstanceAction(instanceId: string) {
    const response = await apiClient<{ status: string }>(`${BASE}/instances/${instanceId}/reset`, {
        method: 'POST',
    });
    if (response.error) return { error: response.error.message };
    return { success: true };
}

/**
 * Mints a new webhook delivery URL and re-registers it.
 *
 * One click because the delivery token is a bearer credential that travels in a
 * URL: this provider signs nothing, so leakage through a proxy log is a when,
 * not an if, and a rotation that needs a support ticket will not happen.
 */
export async function rotateWebhookTokenAction(instanceId: string) {
    const response = await apiClient<UnofficialWhatsAppInstance>(
        `${BASE}/instances/${instanceId}/webhook/rotate`,
        { method: 'POST' },
    );
    if (response.error) return { error: response.error.message };
    return { instance: response.data };
}

/**
 * Opens a conversation with a number that never wrote to us.
 *
 * The server verifies the number is on WhatsApp BEFORE writing anything, so a
 * failure here is usually actionable ("not on WhatsApp") rather than a fault.
 */
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
