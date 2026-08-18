/**
 * Telegram channel types.
 *
 * These mirror `delivery/http/telegram/handler.go`. Three shapes are
 * deliberately not what the Bot API returns, because the backend normalizes
 * them first:
 *
 *  - `botUserId` is a STRING. A Telegram id carries up to 52 significant bits;
 *    a JavaScript number would silently round it.
 *  - No credential is ever present. The bot token and the webhook secret are
 *    write-only: they go in on connect and never come back out, so an
 *    over-broad RBAC grant cannot leak the ability to impersonate the bot.
 *  - `webhookHealthy` is precomputed. It is the channel's data-loss alarm, not
 *    a cosmetic flag: Telegram discards undelivered updates after 24 hours and
 *    has no history API, so a failing webhook is losing messages permanently.
 */

export type TelegramAccountStatus =
    | 'PENDING'
    | 'ACTIVE'
    | 'TOKEN_INVALID'
    | 'WEBHOOK_FAILING'
    | 'REVOKED';

/**
 * How the workspace connected Telegram.
 *
 * These are not variants of one flow. In BOT mode customers message
 * `@yourcompany_bot` and there is no messaging window at all. In BUSINESS mode a
 * bot answers inside the owner's real Telegram account, and a 24h reply window
 * comes back, along with rights the owner can revoke at any moment.
 */
export type TelegramMode = 'BOT' | 'BUSINESS';

export interface TelegramBusinessRights {
    can_reply?: boolean;
    can_read_messages?: boolean;
    can_delete_sent_messages?: boolean;
    can_delete_all_messages?: boolean;
    can_edit_name?: boolean;
    can_edit_bio?: boolean;
    can_edit_profile_photo?: boolean;
    can_edit_username?: boolean;
    can_manage_stories?: boolean;
}

export interface TelegramAccount {
    id: string;
    workspaceId: string;
    departmentId?: string | null;
    mode: TelegramMode;

    /** String, not number, see the file header. */
    botUserId: string;
    botUsername: string;
    botName?: string;
    /** Server-rendered label: `@username`, falling back to the name or the id. */
    displayName: string;
    /** Whether this bot may be attached to a Telegram Business account at all. */
    canConnectToBusiness: boolean;

    status: TelegramAccountStatus;
    statusReason?: string;

    webhookSetAt?: string;
    /**
     * Updates Telegram is holding because it cannot reach us. A rising number is
     * a countdown, not a statistic: after 24 hours those updates are gone.
     */
    webhookPendingCount: number;
    webhookLastError?: string;
    webhookHealthy: boolean;

    businessUsername?: string;
    businessEnabled: boolean;
    businessRights?: TelegramBusinessRights | null;

    agentId?: string | null;
    workflowId?: string | null;
    pipelineId?: string | null;
    enableAgentResponses: boolean;
    enableWorkflow: boolean;
    enableAnalysis: boolean;
    enableAutoStaging: boolean;
    enableAutoMemory: boolean;

    createdAt: string;
    updatedAt: string;
}

export interface TelegramAccountListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface ConnectTelegramPayload {
    /** The token BotFather hands the operator, e.g. `123456:ABC-DEF…`. */
    botToken: string;
    departmentId?: string | null;
}

export interface UpdateTelegramAccountPayload {
    departmentId?: string | null;
    agentId?: string | null;
    workflowId?: string | null;
    pipelineId?: string | null;
    enableAgentResponses?: boolean;
    enableWorkflow?: boolean;
    enableAnalysis?: boolean;
    enableAutoStaging?: boolean;
    enableAutoMemory?: boolean;
}

/**
 * A t.me deep link with its attribution.
 *
 * This is the channel's answer to having no cold outbound. A bot cannot message
 * a customer first, but a link in an e-mail, an invoice or a QR code opens an
 * already-attributed conversation on the customer's first tap.
 */
export interface TelegramDeepLink {
    token: string;
    accountId: string;
    workspaceId: string;
    label?: string;
    leadId?: string | null;
    campaignId?: string | null;
    agentId?: string | null;
    departmentId?: string | null;
    expiresAt?: string | null;
    usedAt?: string | null;
    useCount: number;
    createdAt: string;
}

export interface TelegramDeepLinkResult {
    link: TelegramDeepLink;
    /** The shareable `https://t.me/<bot>?start=<token>` URL. */
    url: string;
}

export interface CreateDeepLinkPayload {
    label?: string;
    leadId?: string | null;
    campaignId?: string | null;
    agentId?: string | null;
    departmentId?: string | null;
    /** Zero or omitted means the link never expires, right for a printed QR. */
    ttlHours?: number;
}

/**
 * Whether a bot token is even plausible before spending a round trip.
 *
 * BotFather issues `<bot_id>:<secret>`, so a paste that does not look like that
 * is a typo, usually the bot's @username, or the token with the surrounding
 * text still attached.
 */
export function looksLikeBotToken(token: string): boolean {
    return /^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token.trim());
}

/**
 * Whether an account needs operator action, and why.
 *
 * The two failure modes are genuinely different and must not be collapsed into
 * one "unhealthy" chip: a dead token needs a new token from BotFather, while a
 * failing webhook needs one button and is losing messages meanwhile.
 */
export function telegramAccountIssue(
    account: TelegramAccount,
): 'token' | 'webhook' | null {
    if (account.status === 'TOKEN_INVALID' || account.status === 'REVOKED') return 'token';
    if (account.status === 'WEBHOOK_FAILING' || !account.webhookHealthy) return 'webhook';
    return null;
}
