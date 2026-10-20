export const MERCADOLIVRE_ACCOUNT_STATUSES = ["CONNECTED", "NEEDS_RECONNECT", "REVOKED", "DISCONNECTED"] as const;

export type MercadoLivreAccountStatus = (typeof MERCADOLIVRE_ACCOUNT_STATUSES)[number];

export interface MercadoLivreAccount {
  id: string;
  workspaceId: string;
  departmentId?: string | null;

  mlUserId: string;
  siteId: string;
  nickname: string;

  status: MercadoLivreAccountStatus;
  statusReason?: string;
  needsReconnect: boolean;

  grantedScopes: string[];
  canReadQuestions: boolean;
  canAnswerQuestions: boolean;
  canReadMessages: boolean;
  canSendMessages: boolean;

  accessExpiresAt?: string;
  lastReconciledAt?: string;
  lastHealthCheckAt?: string;
  purgeAfter?: string;

  agentId?: string | null;
  workflowId?: string | null;
  pipelineId?: string | null;
  enableAgentResponses: boolean;
  enableWorkflow: boolean;
  automationDisclosure: string;

  createdAt: string;
  updatedAt: string;
}

export type MercadoLivreCapability = "canReadMessages" | "canSendMessages" | "canReadQuestions" | "canAnswerQuestions";

export const MERCADOLIVRE_CAPABILITIES: readonly MercadoLivreCapability[] = [
  "canReadMessages",
  "canSendMessages",
  "canReadQuestions",
  "canAnswerQuestions",
];

export interface MercadoLivreAccountListMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export interface MercadoLivreAccountChanges {
  departmentId?: string | null;
  agentId?: string | null;
  workflowId?: string | null;
  pipelineId?: string | null;
  enableAgentResponses?: boolean;
  enableWorkflow?: boolean;
  automationDisclosure?: string;
}

export interface MercadoLivreAccountUpdateBody {
  departmentId?: string;
  agentId?: string;
  workflowId?: string;
  pipelineId?: string;
  enableAgentResponses?: boolean;
  enableWorkflow?: boolean;
  automationDisclosure?: string;
}

export interface MercadoLivreDisconnectResult {
  status: "disconnected";
  purgeAfter: string;
  warning?: string;
}

export const MERCADOLIVRE_CONNECT_ERRORS = [
  "not_account_admin",
  "site_not_supported",
  "missing_permission",
  "already_linked",
  "authorization_declined",
  "mercadolivre_unreachable",
  "invalid_state",
  "expired_state",
  "connect_failed",
] as const;

export type MercadoLivreConnectError = (typeof MERCADOLIVRE_CONNECT_ERRORS)[number];

export type MercadoLivreConnectStatus = "connected" | "reconnected" | "error" | "cancelled";

export interface MercadoLivreConnectResult {
  status: MercadoLivreConnectStatus;
  nickname?: string;
  accountId?: string;
  reason?: MercadoLivreConnectError;
}

export const MERCADOLIVRE_ERROR_CODES = [
  "reconnect_required",
  "mercadolivre_unreachable",
  "reference_not_in_workspace",
  "text_charset",
  "text_too_long",
  "invalid_status",
  "invalid_cursor",
  "invalid_limit",
  "question_not_open",
  "answer_invalid",
  "account_unavailable",
] as const;

export type MercadoLivreErrorCode = (typeof MERCADOLIVRE_ERROR_CODES)[number];

export interface MercadoLivreActionError {
  error: string;
  code?: string;
  status?: number;
}

export interface MercadoLivrePage<T> {
  data: T[];
  nextCursor?: string;
}

export const MERCADOLIVRE_LISTING_STATUSES = ["active", "paused", "closed"] as const;

export type MercadoLivreListingStatus = (typeof MERCADOLIVRE_LISTING_STATUSES)[number];

export interface MercadoLivreListing {
  id: string;
  accountId: string;
  itemId: string;
  title: string;
  permalink?: string;
  status: string;
  thumbnailUrl?: string;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MercadoLivreListingQuery {
  search?: string;
  status?: MercadoLivreListingStatus;
  cursor?: string;
  limit?: number;
}

export const MERCADOLIVRE_QUESTION_STATUSES = [
  "UNANSWERED",
  "ANSWERED",
  "CLOSED_UNANSWERED",
  "UNDER_REVIEW",
  "BANNED",
  "DELETED",
  "DISABLED",
] as const;

export type MercadoLivreQuestionStatus = (typeof MERCADOLIVRE_QUESTION_STATUSES)[number];

export const MERCADOLIVRE_ANSWER_SOURCES = ["operator", "rule", "mercadolivre_app"] as const;

export type MercadoLivreAnswerSource = (typeof MERCADOLIVRE_ANSWER_SOURCES)[number];

export interface MercadoLivreQuestionAsker {
  contactId: string;
  mlUserId: string;
  nickname?: string;
}

export interface MercadoLivreQuestion {
  id: string;
  accountId: string;
  itemId: string;
  questionId: string;
  text: string;
  status: string;
  answerText?: string;
  answerStatus?: string;
  answeredBy?: string;
  answeredByUserId?: string;
  ruleId?: string;
  askedAt: string;
  answeredAt?: string;
  suspectedSpam: boolean;
  asker?: MercadoLivreQuestionAsker;
  listing?: MercadoLivreListing;
}

export interface MercadoLivreQuestionQuery {
  status?: MercadoLivreQuestionStatus;
  itemId?: string;
  cursor?: string;
  limit?: number;
}

export interface MercadoLivreResponseTimeSlot {
  minutes: number;
  salesPercentIncrease?: number;
}

export interface MercadoLivreResponseTime {
  available: boolean;
  total?: MercadoLivreResponseTimeSlot;
  weekdaysWorkingHours?: MercadoLivreResponseTimeSlot;
  weekdaysExtraHours?: MercadoLivreResponseTimeSlot;
  weekend?: MercadoLivreResponseTimeSlot;
}

export interface MercadoLivreCommentRulePayload {
  name: string;
  enabled: boolean;
  containerId: string;
  match: "any" | "contains" | "exact";
  keywords: string[];
  actions: ("public_reply" | "delete")[];
  publicReplyText: string;
  privateReplyText: string;
  priority: number;
}

export interface MercadoLivreCommentRule {
  id: string;
  accountId: string;
  source: string;
  name: string;
  enabled: boolean;
  containerId?: string;
  match: "any" | "contains" | "exact";
  keywords: string[];
  actions: ("public_reply" | "delete")[];
  publicReplyText?: string;
  privateReplyText?: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface MercadoLivreReasonVar {
  id: string;
  type: string;
}

export interface MercadoLivreReasonTemplate {
  id: string;
  vars: MercadoLivreReasonVar[];
}

export interface MercadoLivreReasonOption {
  id: string;
  type?: string;
  enabled: boolean;
  actionable: boolean;
  charLimit?: number;
  capAvailable: number;
  templates: MercadoLivreReasonTemplate[];
}

export interface MercadoLivreReasonSendBody {
  optionId: string;
  templateId: string;
  text: string;
  vars: { id: string; value: number }[];
}

export interface MercadoLivrePackItem {
  itemId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  currency?: string;
  thumbnailUrl?: string;
  permalink?: string;
}

export interface MercadoLivrePackSummary {
  items: MercadoLivrePackItem[];
  orderStatus: string;
  shippingStatus: string;
  shippingSubstatus?: string;
  total: number;
  currency: string;
  refreshedAt: string;
}
