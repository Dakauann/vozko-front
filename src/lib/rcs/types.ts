import type { CarrierChannelAutomation, CarrierPrice } from "@/lib/carrier-messaging/types";

export const RCS_CONTENT_KINDS = ["text", "media", "rich_card", "carousel"] as const;
export type RcsContentKind = (typeof RCS_CONTENT_KINDS)[number];

export const RCS_BILLING_CLASSES = ["basic", "single"] as const;
export type RcsBillingClass = (typeof RCS_BILLING_CLASSES)[number];

export const RCS_MEDIA_KINDS = ["image", "video", "audio", "pdf"] as const;
export type RcsMediaKind = (typeof RCS_MEDIA_KINDS)[number];

export interface RcsMedia {
  kind: RcsMediaKind;
  url: string;
  mime_type: string;
  name?: string;
  size_bytes?: number;
}

export const RCS_SUGGESTION_KINDS = ["reply", "open_url", "dial", "view_location", "calendar"] as const;
export type RcsSuggestionKind = (typeof RCS_SUGGESTION_KINDS)[number];

export interface RcsCalendarEvent {
  title: string;
  description?: string;
  starts_at: string;
  ends_at: string;
}

export interface RcsSuggestion {
  kind: RcsSuggestionKind;
  label: string;
  postback?: string;
  url?: string;
  webview?: boolean;
  phone?: string;
  latitude?: number;
  longitude?: number;
  location_label?: string;
  calendar?: RcsCalendarEvent;
}

export interface RcsCard {
  media?: RcsMedia;
  title?: string;
  description?: string;
  suggestions?: RcsSuggestion[];
}

export interface RcsContent {
  text?: string;
  media?: RcsMedia;
  cards?: RcsCard[];
  suggestions?: RcsSuggestion[];
}

export interface RcsButtonKey {
  card: number;
  index: number;
}

export const RCS_CHARGE_KINDS = ["rcs_basic", "rcs_single", "rcs_conversation", "rcs_inbound"] as const;
export type RcsChargeKind = (typeof RCS_CHARGE_KINDS)[number];

export const RCS_BILLING_CATEGORIES = ["non_conversational", "conversational"] as const;
export type RcsBillingCategory = (typeof RCS_BILLING_CATEGORIES)[number];

export const RCS_USE_CASES = ["transactional", "promotional", "otp", "multi_use"] as const;
export type RcsUseCase = (typeof RCS_USE_CASES)[number];

export const RCS_SECTORS = [
  "retail",
  "services",
  "finance",
  "health",
  "education",
  "travel",
  "gambling",
  "political",
  "adult",
  "other",
] as const;
export type RcsSector = (typeof RCS_SECTORS)[number];

export const RCS_SENDER_STATUSES = ["draft", "submitted", "awaiting_confirmation", "launched", "paused", "rejected"] as const;
export type RcsSenderStatus = (typeof RCS_SENDER_STATUSES)[number];

export const RCS_PAUSED_BY = ["platform", "carrier"] as const;
export type RcsPausedBy = (typeof RCS_PAUSED_BY)[number];

export const RCS_PAUSE_REASONS = ["manual", "complaints", "opt_out_rate", "unpaid_balance", "carrier"] as const;
export type RcsPauseReason = (typeof RCS_PAUSE_REASONS)[number];

export interface RcsSender {
  id: string;
  brand_name: string;
  description: string;
  suggested_description: string;
  logo_url: string;
  banner_url: string;
  color: string;
  use_case: RcsUseCase | "";
  sector: RcsSector | "";
  gambling_authorization_url: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  website_url: string;
  privacy_url: string;
  terms_url: string;
  cnpj: string;
  billing_category: RcsBillingCategory | "";
  status: RcsSenderStatus;
  status_reason: string;
  paused_by: RcsPausedBy | "";
  pause_reason: RcsPauseReason | "";
  submitted_at: string | null;
  launched_at: string | null;
  paused_at: string | null;
  created_at: string;
  can_send: boolean;
  editable: boolean;
  can_resume: boolean;
  department_id: string | null;
  pipeline_id: string | null;
  automation: CarrierChannelAutomation;
  workspace_id?: string;
}

export interface RcsSenderInput {
  brand_name: string;
  description: string;
  logo_url: string;
  banner_url: string;
  color: string;
  use_case: RcsUseCase | "";
  sector: RcsSector | "";
  gambling_authorization_url: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  website_url: string;
  privacy_url: string;
  terms_url: string;
  cnpj: string;
  billing_category: RcsBillingCategory | "";
}

export interface RcsSenderList {
  senders: RcsSender[];
}

export interface RcsContentIssue {
  code: string;
  path: string;
}

export type RcsPrice = CarrierPrice<RcsChargeKind>;

export interface RcsContentCheckRequest {
  content: RcsContent;
}

export interface RcsContentCheck {
  kind: RcsContentKind;
  billing_class: RcsBillingClass;
  variable_slots: number;
  issues: RcsContentIssue[];
  price: RcsPrice;
}

export interface RcsMediaResolveRequest {
  media_id: string;
}
