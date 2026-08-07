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

// ---------------------------------------------------------------- groups

/**
 * The group endpoints.
 *
 * A group is addressed by its WhatsApp JID rather than by a row id we assigned,
 * because a workspace can act on a group the CRM has never opened and therefore
 * has no row for. The JID contains an `@`, so every call encodes it.
 *
 * None of these polls. The server keeps a cached copy with a staleness clock and
 * re-reads only when it is stale or when `refresh` is asked for explicitly — a
 * panel that re-read on every render would spend the customer's own number's API
 * budget on a screen whose content changes weekly, and traffic that looks
 * automated is what gets an unofficial number banned.
 */
function groupPath(instanceId: string, groupJid: string, suffix = '') {
    return `${BASE}/instances/${instanceId}/groups/${encodeURIComponent(groupJid)}${suffix}`;
}

/**
 * The same endpoints addressed by CONVERSATION.
 *
 * The CRM holds an entry id and never a WhatsApp JID, and the server offers both
 * shapes under identical RBAC. Using this one from the inbox avoids leaking a
 * channel-specific `group_jid` into InboxEntry — the channel-neutral shape every
 * list in the CRM renders, which Instagram and Telegram also read.
 */
function conversationGroupPath(entryId: string, suffix = '') {
    return `${BASE}/conversations/${encodeURIComponent(entryId)}/group${suffix}`;
}

/** Lists the groups a connected number belongs to. Served from our own rows;
 *  rosters are not included. */
export async function listGroupsAction(instanceId: string) {
    const response = await apiClient<UnofficialWhatsAppGroup[]>(
        `${BASE}/instances/${instanceId}/groups`,
        { method: 'GET' },
    );
    if (response.error) return { groups: [] as UnofficialWhatsAppGroup[], error: response.error.message };
    return { groups: response.data ?? [] };
}

/**
 * Reads one group with its roster.
 *
 * `refresh` forces past both our staleness clock and the provider's own cache.
 * It is what the panel's refresh button sends, and the only path that always
 * costs a call to WhatsApp — which is why it is an explicit opt-in and not the
 * default.
 */
export async function getGroupAction(instanceId: string, groupJid: string, refresh = false) {
    const response = await apiClient<UnofficialWhatsAppGroup>(
        groupPath(instanceId, groupJid, refresh ? '?refresh=true' : ''),
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return { group: response.data };
}

/**
 * Fetches the group's join link.
 *
 * Its own call, never folded into the read: the link is a standing credential —
 * anyone who receives it can join the customer's group — so it is fetched when
 * an operator asks and is not cached in the page.
 */
export async function getGroupInviteLinkAction(instanceId: string, groupJid: string) {
    const response = await apiClient<{ inviteLink: string }>(
        groupPath(instanceId, groupJid, '/invite-link'),
        { method: 'GET' },
    );
    if (response.error) return { error: response.error.message };
    return { inviteLink: response.data?.inviteLink ?? '' };
}

/**
 * Applies whichever fields were submitted.
 *
 * Send ONLY what changed. Every field is optional server-side and an absent one
 * means "leave it alone", so posting the whole form would re-open an
 * announce-only group every time somebody corrected a typo in its name.
 *
 * The response is a fresh read rather than an echo of the request: a provider
 * acknowledgement says only that the change was accepted, and the two diverge
 * whenever it is partially applied.
 */
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

/**
 * Adds, promotes, demotes, approves, removes or rejects members.
 *
 * The destructive verbs go to a DELETE on the same path, because the server
 * guards them with a different permission: an attendant trusted to invite people
 * into a group is not thereby trusted to throw them out. Routing them here keeps
 * the client from having to remember which is which.
 */
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

/**
 * Leaves the group.
 *
 * The CONVERSATION stays. The transcript is history and leaving does not mean
 * the messages stopped having been exchanged — an operator still needs to read
 * what was said.
 */
export async function leaveGroupAction(instanceId: string, groupJid: string) {
    const response = await apiClient<{ left: boolean }>(
        groupPath(instanceId, groupJid, '/leave'),
        { method: 'POST' },
    );
    if (response.error) return { error: response.error.message };
    return { success: true };
}

// ------------------------------------------- groups, addressed by conversation

/**
 * Reads the group behind an open conversation.
 *
 * `refresh` forces past both our staleness clock and the provider's cache, and
 * is the only path that always costs a call to the customer's own WhatsApp —
 * which is why the panel sends it on an explicit refresh and never on mount.
 */
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

/** Sends ONLY the fields that changed. An absent field means "leave it alone",
 *  so posting the whole form would re-open an announce-only group on every
 *  unrelated edit. */
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


// ---------------------------------------------------------------- allowance

/**
 * Reads how many numbers this workspace may connect.
 *
 * Its own call rather than a field on the instance list: the connect screen
 * needs it before any list is rendered, and folding it into a paginated list
 * would make "how many may I have" a property of page 1.
 */
export async function getInstanceAllowanceAction() {
    const response = await apiClient<UnofficialWhatsAppAllowance>(`${BASE}/instances/allowance`, {
        method: 'GET',
    });
    if (response.error) return { error: response.error.message };
    return { allowance: response.data };
}
