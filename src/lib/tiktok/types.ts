import type { CommentRuleAction, CommentRuleMatch } from "@/lib/social/comment-rules";

export const TIKTOK_ACCOUNT_STATUSES = ["CONNECTED", "NEEDS_RECONNECT", "REVOKED", "DISCONNECTED"] as const;

export type TiktokAccountStatus = (typeof TIKTOK_ACCOUNT_STATUSES)[number];

export interface TiktokCapabilities {
  canReadVideos: boolean;
  canReadComments: boolean;
  canManageComments: boolean;
  canReceiveMessages: boolean;
  canSendMessages: boolean;
  canManageInboxProfile: boolean;
}

export type TiktokCapability = keyof TiktokCapabilities;

export const TIKTOK_CAPABILITIES: readonly TiktokCapability[] = [
  "canReadComments",
  "canManageComments",
  "canReceiveMessages",
  "canSendMessages",
];

export interface TiktokAccount {
  id: string;
  workspaceId: string;
  departmentId?: string | null;

  openId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  hasAdvancedAccess: boolean;
  isBusinessAccount: boolean;

  status: TiktokAccountStatus;
  statusReason?: string;
  capabilities: TiktokCapabilities;
  grantedScopes: string[];
  webhooksHealthy: boolean;
  reconnectBy?: string;
  reconnectSoon: boolean;
  purgeAfter?: string;
  lastHealthCheckAt?: string;

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

export interface TiktokAccountListMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export interface TiktokAccountChanges {
  departmentId?: string | null;
  agentId?: string | null;
  workflowId?: string | null;
  pipelineId?: string | null;
  enableAgentResponses?: boolean;
  enableWorkflow?: boolean;
  enableAnalysis?: boolean;
  enableAutoStaging?: boolean;
  enableAutoMemory?: boolean;
  automationDisclosure?: string;
}

export interface TiktokAccountUpdateBody {
  departmentId?: string;
  agentId?: string;
  workflowId?: string;
  pipelineId?: string;
  enableAgentResponses?: boolean;
  enableWorkflow?: boolean;
  enableAnalysis?: boolean;
  enableAutoStaging?: boolean;
  enableAutoMemory?: boolean;
  automationDisclosure?: string;
}

export interface TiktokDisconnectResult {
  purgeAfter: string;
  warning?: string;
}

export type TiktokMediaType = "VIDEO" | "PHOTO";

export interface TiktokVideo {
  itemId: string;
  mediaType: TiktokMediaType;
  caption: string;
  shareUrl?: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  isAd: boolean;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  postedAt?: string;
}

export interface TiktokVideoPage {
  videos: TiktokVideo[];
  nextCursor?: string;
  hasMore: boolean;
}

export type TiktokCommentKind = "comment" | "reply";

export type TiktokCommentVisibility = "public" | "hidden" | "friends_only" | "deleted" | "";

export interface TiktokComment {
  commentId: string;
  videoId: string;
  parentCommentId?: string;
  kind: TiktokCommentKind;
  authorUsername?: string;
  authorDisplayName?: string;
  contactId?: string;
  text: string;
  imageUrl?: string;
  visibility: TiktokCommentVisibility;
  isOurs: boolean;
  likedByUs: boolean;
  likes: number;
  replies: number;
  commentedAt?: string;
  canReply: boolean;
  canHide: boolean;
  canLike: boolean;
}

export interface TiktokCommentPage {
  comments: TiktokComment[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface TiktokCommentRule {
  id: string;
  accountId: string;
  source: string;
  name: string;
  enabled: boolean;
  containerId?: string;
  match: CommentRuleMatch;
  keywords: string[];
  actions: CommentRuleAction[];
  publicReplyText?: string;
  privateReplyText?: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface TiktokCommentRulePayload {
  name: string;
  enabled: boolean;
  containerId: string;
  match: CommentRuleMatch;
  keywords: string[];
  actions: CommentRuleAction[];
  publicReplyText: string;
  privateReplyText: string;
  priority: number;
}

export const TIKTOK_CONNECT_ERRORS = [
  "declined",
  "code_missing",
  "scope_missing",
  "not_eligible_account",
  "already_linked",
  "identity_mismatch",
  "probe_inconclusive",
  "invalid_state",
  "expired_state",
  "connect_failed",
] as const;

export type TiktokConnectError = (typeof TIKTOK_CONNECT_ERRORS)[number];

export type TiktokConnectStatus = "connected" | "reconnected" | "error" | "cancelled";

export interface TiktokConnectResult {
  status: TiktokConnectStatus;
  username?: string;
  accountId?: string;
  reason?: TiktokConnectError;
}

export interface TiktokActionError {
  error: string;
  code?: string;
  status?: number;
}
