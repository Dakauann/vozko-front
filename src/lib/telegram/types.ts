
export type TelegramAccountStatus =
    | 'PENDING'
    | 'ACTIVE'
    | 'TOKEN_INVALID'
    | 'WEBHOOK_FAILING'
    | 'REVOKED';

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

    botUserId: string;
    botUsername: string;
    botName?: string;
    displayName: string;
    canConnectToBusiness: boolean;

    status: TelegramAccountStatus;
    statusReason?: string;

    webhookSetAt?: string;
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
    url: string;
}

export interface CreateDeepLinkPayload {
    label?: string;
    leadId?: string | null;
    campaignId?: string | null;
    agentId?: string | null;
    departmentId?: string | null;
    ttlHours?: number;
}

export function looksLikeBotToken(token: string): boolean {
    return /^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token.trim());
}

export function telegramAccountIssue(
    account: TelegramAccount,
): 'token' | 'webhook' | null {
    if (account.status === 'TOKEN_INVALID' || account.status === 'REVOKED') return 'token';
    if (account.status === 'WEBHOOK_FAILING' || !account.webhookHealthy) return 'webhook';
    return null;
}
