import type { CommentRuleAction, CommentRuleMatch } from '@/lib/social/comment-rules';

export type FacebookPageStatus =
    | 'PENDING'
    | 'CONNECTED'
    | 'TOKEN_REVOKED'
    | 'NEEDS_ROLE'
    | 'RESTRICTED'
    | 'DISCONNECTED';

export interface FacebookCapabilities {
    messaging: boolean;
    readPosts: boolean;
    publish: boolean;
    moderate: boolean;
    comment: boolean;
    subscribe: boolean;
}

export type FacebookCapability = keyof FacebookCapabilities;

export interface FacebookRouting {
    isDefaultApp: boolean | null;
    checkedAt?: string;
}

export interface FacebookPolicy {
    action?: string;
    reason?: string;
    at?: string;
}

export interface FacebookPage {
    id: string;
    workspaceId: string;
    departmentId?: string | null;
    fbPageId: string;
    name: string;
    username?: string;
    category?: string;
    link?: string;
    pictureUrl?: string;
    followersCount: number;
    linkedInstagramUserId?: string;

    status: FacebookPageStatus;
    statusReason?: string;
    tasks: string[];
    grantedScopes: string[];
    capabilities: FacebookCapabilities;
    needsReconnect: boolean;

    webhookSubscribedAt?: string;
    subscribedFields: string[];
    routing: FacebookRouting;
    policy: FacebookPolicy;
    humanAgentAvailable: boolean;
    healthCheckedAt?: string;

    agentId?: string | null;
    workflowId?: string | null;
    pipelineId?: string | null;
    enableAgentResponses: boolean;
    enableWorkflow: boolean;
    enableAnalysis: boolean;
    enableAutoStaging: boolean;
    enableAutoMemory: boolean;
    automationDisclosure: string;

    createdAt: string;
    updatedAt: string;
}

export interface FacebookPageListMeta {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
}

export type FacebookConnectStatus = 'connected' | 'partial' | 'error' | 'cancelled';

export type FacebookPageOutcome =
    | 'connected'
    | 'reconnected'
    | 'already_linked_elsewhere'
    | 'missing_task'
    | 'missing_permission';

export interface FacebookPageConnectOutcome {
    id?: string;
    fbPageId: string;
    name: string;
    outcome: FacebookPageOutcome;
    missing: string[];
    warning?: string;
}

export interface FacebookConnectResult {
    status: FacebookConnectStatus;
    pages?: FacebookPageConnectOutcome[];
    reason?: string;
    connected?: number;
    skipped?: number;
}

export type FacebookPostKind =
    | 'status'
    | 'link'
    | 'photo'
    | 'album'
    | 'video'
    | 'reel'
    | 'story'
    | 'shared'
    | 'visitor';

export interface FacebookPostAttachment {
    mediaType: string;
    title?: string;
    url?: string;
    assetIndex: number;
}

export interface FacebookPost {
    id: string;
    kind: FacebookPostKind;
    message: string;
    story?: string;
    permalinkUrl?: string;
    createdTime?: string;
    updatedTime?: string;
    isPublished: boolean;
    scheduledPublishTime: string | null;
    isHidden: boolean;
    editable: boolean;
    reactionsCount: number;
    commentsCount: number;
    sharesCount: number;
    hasAsset: boolean;
    attachments: FacebookPostAttachment[];
}

export type FacebookPostListKind = 'published' | 'scheduled' | 'reels';

export interface FacebookList<T> {
    items: T[];
    nextCursor?: string;
    hasNext: boolean;
}

export type FacebookStoryStatus = 'PUBLISHED' | 'ARCHIVED';

export interface FacebookStory {
    id: string;
    status: FacebookStoryStatus;
    mediaType: string;
    createdTime?: string;
    url?: string;
}

export type FacebookPublishKind = 'text' | 'link' | 'photo' | 'album' | 'video' | 'reel' | 'story';

export interface FacebookMediaRef {
    url: string;
    mimeType: string;
    sizeBytes: number;
}

export interface CreateFacebookPostPayload {
    kind: FacebookPublishKind;
    message?: string;
    link?: string;
    media?: FacebookMediaRef[];
    videoTitle?: string;
    scheduledPublishTime?: string;
}

export type UpdateFacebookPostPayload =
    | { message: string }
    | { isHidden: boolean }
    | { publishNow: true }
    | { scheduledPublishTime: string };

export type FacebookPublishJobStatus =
    | 'QUEUED'
    | 'UPLOADING'
    | 'PROCESSING'
    | 'PUBLISHED'
    | 'SCHEDULED'
    | 'FAILED';

export interface FacebookPublishJobError {
    code?: number;
    subcode?: number;
    message: string;
    ambiguous: boolean;
}

export interface FacebookPublishJob {
    id: string;
    kind: FacebookPublishKind;
    status: FacebookPublishJobStatus;
    fbPostId?: string;
    scheduledAt?: string;
    error: FacebookPublishJobError | null;
    createdAt: string;
    updatedAt: string;
}

export interface FacebookCommentAuthor {
    id?: string;
    name?: string;
    isPage: boolean;
    contactId?: string;
}

export type FacebookPrivateReplyStatus = 'NONE' | 'ATTEMPTED' | 'SENT' | 'FAILED';

export interface FacebookComment {
    id: string;
    parentId?: string;
    message: string;
    createdTime?: string;
    from: FacebookCommentAuthor | null;
    likeCount: number;
    replyCount: number;
    isHidden: boolean;
    isOurs: boolean;
    likedByPage: boolean;
    canHide: boolean;
    canRemove: boolean;
    canReplyPrivately: boolean;
    canLike: boolean;
    canEdit: boolean;
    privateReply: { status: FacebookPrivateReplyStatus; deadline?: string };
    attachment?: { type: string; url?: string };
}

export type FacebookCommentFilter = 'stream' | 'toplevel';

export interface FacebookPrivateReplyResult {
    conversationId: string;
    messageId: string;
}

export interface FacebookCommentRule {
    id: string;
    pageId: string;
    name: string;
    enabled: boolean;
    postId?: string;
    match: CommentRuleMatch;
    keywords: string[];
    actions: CommentRuleAction[];
    publicReplyText?: string;
    privateReplyText?: string;
    priority: number;
    createdAt: string;
    updatedAt: string;
}

export interface FacebookCommentRulePayload {
    name: string;
    enabled: boolean;
    postId: string;
    match: CommentRuleMatch;
    keywords: string[];
    actions: CommentRuleAction[];
    publicReplyText: string;
    privateReplyText: string;
    priority: number;
}

export type FacebookThreadHolder = 'vozko' | 'meta_business_suite' | 'other_app';

export interface FacebookThreadState {
    holder: FacebookThreadHolder;
    ownerAppId: string;
    isDefaultRouteApp: boolean | null;
}

export interface MessengerLocalizedText {
    locale: string;
    text: string;
}

export interface MessengerIceBreaker {
    question: string;
    payload: string;
}

export interface MessengerIceBreakerSet {
    locale: string;
    items: MessengerIceBreaker[];
}

export type MessengerMenuItem =
    | { type: 'postback'; title: string; payload: string }
    | { type: 'web_url'; title: string; url: string };

export interface MessengerPersistentMenu {
    locale: string;
    composerInputDisabled: boolean;
    items: MessengerMenuItem[];
}

export interface MessengerProfile {
    greeting: MessengerLocalizedText[];
    getStarted: { payload: string } | null;
    iceBreakers: MessengerIceBreakerSet[];
    persistentMenu: MessengerPersistentMenu[];
}

export type DataDeletionStatus = 'RECEIVED' | 'COMPLETED' | 'FAILED';

export interface DataDeletionRequest {
    code: string;
    status: DataDeletionStatus;
    requestedAt: string;
    completedAt?: string;
}
