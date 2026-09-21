
export type UnofficialWhatsAppStatus =
    | 'PROVISIONING'
    | 'AWAITING_SCAN'
    | 'CONNECTED'
    | 'HIBERNATED'
    | 'DISCONNECTED'
    | 'BANNED'
    | 'PROVISION_FAILED';

export type ConnectMode = 'qr' | 'pairing';

export interface UnofficialWhatsAppRestriction {
    active: boolean;
    key?: string;
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

    displayName: string;
    phoneNumber?: string;
    profileName?: string;
    profilePicUrl?: string;
    isBusinessAccount: boolean;
    platform?: string;

    status: UnofficialWhatsAppStatus;
    statusReason?: string;
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
    enableAutoMemory: boolean;
    handleGroups: boolean;

    createdAt: string;
    updatedAt: string;
}

export interface LinkChallenge {
    instance: UnofficialWhatsAppInstance;
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
    enableAutoMemory?: boolean;
    handleGroups?: boolean;
    dailySendCap?: number;
    sendDelayMinMs?: number;
    sendDelayMaxMs?: number;
    autoRejectCalls?: boolean;
}



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
    if (instance.restriction?.active) return 'restricted';
    if (!instance.sessionLive) return 'disconnected';
    return null;
}

export function canRelink(instance: UnofficialWhatsAppInstance): boolean {
    return instance.status !== 'BANNED' && instance.status !== 'PROVISIONING';
}

export interface StartedConversation {
    conversationId: string;
    contactId: string;
    phoneNumber: string;
    displayName: string;
    entryType: string;
    alreadyExisted: boolean;
}



export type GroupRole = 'member' | 'admin' | 'superadmin';

export type GroupParticipantAction =
    | 'add'
    | 'promote'
    | 'demote'
    | 'approve'
    | 'remove'
    | 'reject';

export const DESTRUCTIVE_GROUP_ACTIONS: readonly GroupParticipantAction[] = [
    'remove',
    'reject',
];

export interface GroupParticipant {
    jid: string;
    phoneNumber?: string;
    name: string;
    role: GroupRole;
    isAdmin: boolean;
    contactId?: string | null;
}

export interface UnofficialWhatsAppGroup {
    id: string;
    jid: string;
    instanceId: string;
    subject: string;
    description?: string;
    ownerJid?: string;

    adminsOnlyMessages: boolean;
    adminsOnlyEdit: boolean;
    joinApproval: boolean;
    ephemeral: boolean;
    isCommunity: boolean;

    weAreAdmin: boolean;
    canPost: boolean;

    participantCount: number;
    groupCreatedAt?: string | null;
    syncedAt?: string | null;

    participants?: GroupParticipant[];
}

export interface UpdateGroupPayload {
    subject?: string;
    description?: string;
    imageUrl?: string;
    adminsOnlyMessages?: boolean;
    adminsOnlyEdit?: boolean;
}

export const MAX_GROUP_NAME_LENGTH = 25;
export const MAX_GROUP_DESCRIPTION_LENGTH = 512;



export interface UnofficialWhatsAppAllowance {
    limit: number;
    used: number;
    granted: number;
    purchased: number;
    remaining: number;
    canConnect: boolean;
    overLimit: boolean;
}

export type AllowanceBlock = 'none-included' | 'all-in-use' | null;

export function allowanceBlock(a: UnofficialWhatsAppAllowance | null): AllowanceBlock {
    if (!a || a.canConnect) return null;
    return a.limit <= 0 ? 'none-included' : 'all-in-use';
}
