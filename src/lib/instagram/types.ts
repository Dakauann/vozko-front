
export type InstagramAccountStatus =
    | 'PENDING'
    | 'CONNECTED'
    | 'TOKEN_EXPIRED'
    | 'REVOKED'
    | 'SUSPENDED';

export interface InstagramAccount {
    id: string;
    workspaceId: string;
    departmentId?: string | null;
    igUserId: string;
    username: string;
    name?: string;
    profilePictureUrl?: string;
    accountType?: string;
    followersCount: number;
    followsCount: number;
    mediaCount: number;

    status: InstagramAccountStatus;
    statusReason?: string;

    grantedScopes: string[];
    canSendMessages: boolean;
    canManageComments: boolean;
    canPublish: boolean;

    messagingHealthy: boolean;
    messagingCheckedAt?: string;
    webhookSubscribedAt?: string;
    tokenExpiresAt?: string;
    needsReconnect: boolean;

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

export interface InstagramAccountListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export interface InstagramMedia {
    id: string;
    mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
    mediaProductType: 'FEED' | 'REELS' | 'STORY' | 'AD' | string;
    isReel: boolean;
    isCarousel: boolean;
    caption?: string;
    permalink?: string;
    shortcode?: string;
    timestamp?: string;
    likeCount: number;
    commentsCount: number;
    isCommentEnabled?: boolean;
    mediaUrl?: string;
    thumbnailUrl?: string;
    hasAsset: boolean;
    children?: InstagramMedia[];
}

export interface InstagramComment {
    id: string;
    text: string;
    timestamp?: string;
    fromIgsid?: string;
    fromUsername?: string;
    likeCount: number;
    hidden: boolean;
    parentId?: string;
    isOurs: boolean;
    canDelete: boolean;
    replies?: InstagramComment[];
}

export interface InstagramPage<T> {
    items: T[];
    nextCursor?: string;
    hasNext: boolean;
}

export interface UpdateInstagramAccountPayload {
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

export interface CreateInstagramMediaPayload {
    imageUrl?: string;
    videoUrl?: string;
    caption?: string;
    mediaType?: string;
}

export type CommentRuleMatch = 'any' | 'contains' | 'exact';

export type CommentRuleAction = 'public_reply' | 'private_reply' | 'hide';

export interface InstagramCommentRule {
    id: string;
    workspaceId: string;
    igAccountId: string;
    name: string;
    enabled: boolean;
    igMediaId?: string;
    match: CommentRuleMatch;
    keywords: string[];
    actions: CommentRuleAction[];
    publicReplyText?: string;
    privateReplyText?: string;
    priority: number;
    createdAt: string;
    updatedAt: string;
}

export interface CommentRulePayload {
    name: string;
    enabled: boolean;
    igMediaId?: string;
    match: CommentRuleMatch;
    keywords: string[];
    actions: CommentRuleAction[];
    publicReplyText?: string;
    privateReplyText?: string;
    priority?: number;
}
