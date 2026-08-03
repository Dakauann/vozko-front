/**
 * Instagram channel types.
 *
 * These mirror `delivery/http/instagram/dto.go`. A few shapes are deliberately
 * not what the Graph API returns, because the backend normalizes them first:
 *
 *  - `mediaUrl` / `thumbnailUrl` point at OUR proxy, not at Instagram's CDN.
 *    Instagram's URLs are signed and expire, so rendering them directly produces
 *    images that break minutes later.
 *  - `isReel` is precomputed. There is no `mediaType === 'REELS'`: a reel is a
 *    VIDEO with `mediaProductType === 'REELS'`.
 *  - `canDelete` is precomputed from whether we authored the comment, because
 *    Instagram only allows deleting your own comments.
 */

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
    /** Derived server-side so the UI never parses scope strings. */
    canSendMessages: boolean;
    canManageComments: boolean;
    canPublish: boolean;

    /**
     * False when the Instagram app's "Allow access to messages" toggle is off.
     * In that state DMs and webhooks fail silently despite a successful OAuth, so
     * this drives a persistent warning banner.
     */
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
    /** Proxy URLs, not Instagram CDN URLs. */
    mediaUrl?: string;
    thumbnailUrl?: string;
    /** False when Instagram omitted media_url (e.g. copyrighted content). */
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
    /** Mirrors isOurs: Instagram requires the author's token to delete. */
    canDelete: boolean;
    replies?: InstagramComment[];
}

/**
 * Cursor-paginated page.
 *
 * `hasNext` is authoritative. A short page does NOT mean the end, Instagram
 * filters items out of a page after applying the limit, so never infer the end
 * from `items.length`. Cursors are opaque and must not be persisted.
 */
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
}

export interface CreateInstagramMediaPayload {
    /** JPEG only, the sole image format Instagram accepts for publishing. */
    imageUrl?: string;
    videoUrl?: string;
    caption?: string;
    /** REELS or STORIES; omit for a feed image. */
    mediaType?: string;
}

/**
 * Comment automation.
 *
 * A rule reacts to a public comment. Its most valuable action, the private
 * reply, opens a DM conversation, from there the account's agent or workflow
 * attends it, which is why a rule needs no branching of its own.
 */
export type CommentRuleMatch = 'any' | 'contains' | 'exact';

export type CommentRuleAction = 'public_reply' | 'private_reply' | 'hide';

export interface InstagramCommentRule {
    id: string;
    workspaceId: string;
    igAccountId: string;
    name: string;
    enabled: boolean;
    /** Empty means the rule applies to every post on the account. */
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
