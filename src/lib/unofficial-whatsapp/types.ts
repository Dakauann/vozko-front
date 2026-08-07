/**
 * Unofficial WhatsApp channel types.
 *
 * These mirror `delivery/http/unofficial_whatsapp/dto.go`.
 * Four shapes are deliberately not what the provider returns, because the
 * backend normalizes them first:
 *
 *  - **No credential is ever present.** The instance token and the webhook
 *    delivery token are write-only. The delivery token in particular IS the
 *    channel's only authenticity control — this provider does not sign its
 *    webhooks at all — so it never leaves the server and no screen can leak it.
 *  - `sessionLive` is precomputed. The UI must never re-derive "connected" from
 *    the raw status string, or the composer and the backend can disagree.
 *  - `restriction` is WhatsApp's OWN limiting state, carried verbatim including
 *    the provider's pt-BR wording. It describes something the customer can see
 *    in their own WhatsApp; rewording it would drift from what they read there.
 *  - `skippedNotOnWhatsApp` is separate from `failed` on purpose. A number that
 *    is not registered is a list-quality fact, not a delivery failure.
 */

/**
 * The instance lifecycle.
 *
 * `BANNED` is terminal and must never be offered a reconnect: no scan recovers a
 * number Meta has disabled, and a button that can only fail teaches operators to
 * distrust the screen.
 */
export type UnofficialWhatsAppStatus =
    | 'PROVISIONING'
    | 'AWAITING_SCAN'
    | 'CONNECTED'
    | 'HIBERNATED'
    | 'DISCONNECTED'
    | 'BANNED'
    | 'PROVISION_FAILED';

/** How a number is linked. Pairing needs the number up front; QR does not. */
export type ConnectMode = 'qr' | 'pairing';

/**
 * WhatsApp's own restriction state for this number.
 *
 * The earliest warning available before a ban, and the input every send
 * circuit breaker reads. `active` is precomputed server-side so the UI cannot
 * disagree with the send path about whether a number may be used.
 */
export interface UnofficialWhatsAppRestriction {
    active: boolean;
    key?: string;
    /** The provider's own wording. Surfaced verbatim, never paraphrased. */
    message?: string;
    until?: string | null;
    usedQuota?: number;
    totalQuota?: number;
    checkedAt?: string | null;
}

export interface UnofficialWhatsAppInstance {
    id: string;
    workspaceId: string;
    departmentId?: string | null;
    provider: string;

    /** Server-rendered label: the number, falling back to the profile name. */
    displayName: string;
    phoneNumber?: string;
    profileName?: string;
    profilePicUrl?: string;
    isBusinessAccount: boolean;
    platform?: string;

    status: UnofficialWhatsAppStatus;
    statusReason?: string;
    /** The single fact the UI branches on. Never re-derive it from `status`. */
    sessionLive: boolean;

    connectedAt?: string | null;
    lastDisconnectAt?: string | null;
    lastDisconnectReason?: string;
    lastPolledAt?: string | null;
    webhookSetAt?: string | null;

    restriction: UnofficialWhatsAppRestriction;

    dailySendCap: number;
    sendDelayMinMs: number;
    sendDelayMaxMs: number;
    autoRejectCalls: boolean;
    warmupStartedAt?: string | null;

    agentId?: string | null;
    workflowId?: string | null;
    pipelineId?: string | null;
    enableAgentResponses: boolean;
    enableWorkflow: boolean;
    enableAnalysis: boolean;
    enableAutoStaging: boolean;
    handleGroups: boolean;

    createdAt: string;
    updatedAt: string;
}

/**
 * What the customer must act on to link their phone.
 *
 * `expiresAt` is the provider's own deadline, not a guess. A screen that stalls
 * past an expiry with no explanation is indistinguishable from a broken one.
 */
export interface LinkChallenge {
    instance: UnofficialWhatsAppInstance;
    /** A data URI. It rotates, so the screen re-reads rather than caching one. */
    qrCode?: string;
    pairCode?: string;
    expiresAt?: string | null;
}

export interface UnofficialWhatsAppListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface UpdateInstancePayload {
    displayName?: string;
    departmentId?: string | null;
    agentId?: string | null;
    workflowId?: string | null;
    pipelineId?: string | null;
    enableAgentResponses?: boolean;
    enableWorkflow?: boolean;
    enableAnalysis?: boolean;
    enableAutoStaging?: boolean;
    handleGroups?: boolean;
    dailySendCap?: number;
    sendDelayMinMs?: number;
    sendDelayMaxMs?: number;
    autoRejectCalls?: boolean;
}


// ---------------------------------------------------------------- derived

/**
 * What is wrong with this number, if anything, as one value the UI branches on.
 *
 * Derived in one place because three surfaces need the same answer — the list
 * row, the detail header and the composer — and three inline ternaries would
 * eventually disagree. Ordered by severity: a banned number is not merely
 * disconnected, and a restricted one is not merely idle.
 */
export type InstanceIssue =
    | 'banned'
    | 'restricted'
    | 'disconnected'
    | 'awaiting-scan'
    | 'provisioning'
    | 'provision-failed'
    | null;

export function instanceIssue(instance: UnofficialWhatsAppInstance): InstanceIssue {
    if (instance.status === 'BANNED') return 'banned';
    if (instance.status === 'PROVISION_FAILED') return 'provision-failed';
    if (instance.status === 'PROVISIONING') return 'provisioning';
    if (instance.status === 'AWAITING_SCAN') return 'awaiting-scan';
    // A restriction outranks a live session: the number is connected and still
    // cannot start conversations, which is the state most likely to be missed.
    if (instance.restriction?.active) return 'restricted';
    if (!instance.sessionLive) return 'disconnected';
    return null;
}

/** Whether a reconnect can possibly help. A ban is terminal. */
export function canRelink(instance: UnofficialWhatsAppInstance): boolean {
    return instance.status !== 'BANNED' && instance.status !== 'PROVISIONING';
}

/** Where the CRM should take the operator after opening a conversation. */
export interface StartedConversation {
    conversationId: string;
    contactId: string;
    phoneNumber: string;
    displayName: string;
    /** The channel's entry type, so the inbox can route without hardcoding it. */
    entryType: string;
    /** True when the chat was already in the inbox and was reopened, not created. */
    alreadyExisted: boolean;
}
