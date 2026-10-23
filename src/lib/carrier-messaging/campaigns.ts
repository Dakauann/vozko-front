import { parseAudienceCount } from "@/lib/campaign-audience/parse";
import type { AudienceCount } from "@/lib/campaign-audience/types";
import { oneOf } from "@/lib/carrier-messaging/parse";
import { isCount, isJson, isText } from "@/lib/json/guards";
import type { LeadSelection } from "@/lib/leads/actions";
import type { VariableBinding } from "@/lib/leads/sends";
import type { RcsContent } from "@/lib/rcs/types";

export const CAMPAIGN_CHANNELS = ["rcs", "sms"] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

export const CAMPAIGN_STATUSES = ["draft", "ready", "scheduled", "running", "paused", "completed", "stopped"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_KINDS = ["marketing", "transactional"] as const;
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];

export const RECURRENCE_FREQUENCIES = ["daily", "weekly", "monthly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const CAMPAIGN_LIMITS = { maxNameRunes: 120, minVariants: 1, maxVariants: 4 } as const;

export const SKIP_REASONS = ["no_phone", "opted_out", "blocked", "suppressed", "frequency_cap", "duplicate", "missing_variable", "sender_paused", "balance"] as const;

export const RECIPIENT_STATUSES = ["pending", "sent", "skipped", "failed"] as const;
export type RecipientStatus = (typeof RECIPIENT_STATUSES)[number];

export interface CampaignRecurrence {
  frequency: RecurrenceFrequency;
  time: string;
  weekdays?: number[];
  day_of_month?: number;
  timezone: string;
  until?: string;
}

export interface CampaignVariant {
  name: string;
  content?: RcsContent;
  text?: string;
  bindings: VariableBinding[];
}

export interface CampaignWhatsAppFallback {
  business_phone_id: string;
  template_id: string;
  body_bindings: VariableBinding[];
  header_bindings: VariableBinding[];
}

export interface CampaignSmsFallback {
  route_id: string;
  text: string;
  bindings: VariableBinding[];
}

export interface CampaignFallback {
  whatsapp?: CampaignWhatsAppFallback;
  sms?: CampaignSmsFallback;
}

export interface CampaignDraft {
  name: string;
  channel: CampaignChannel;
  kind: CampaignKind;
  sender_id: string;
  variants: CampaignVariant[];
  fallback: CampaignFallback;
  audience: LeadSelection | null;
  scheduled_at: string | null;
  recurrence: CampaignRecurrence | null;
}

export interface Campaign extends CampaignDraft {
  id: string;
  status: CampaignStatus;
}

export interface CampaignStats {
  targeted: number;
  sent: number;
  delivered: number;
  read: number;
  clicks: number;
  replies: number;
}

export interface CampaignSummary {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  kind: CampaignKind;
  sender_id: string;
  scheduled_at: string | null;
  recurrence: CampaignRecurrence | null;
  created_at: string;
  stats: CampaignStats;
}

export interface CampaignPage {
  items: CampaignSummary[];
  total: number;
}

export interface CampaignEstimate {
  channel: CampaignChannel;
  recipients: number;
  messages: number;
  worst_case_segments?: number;
  worst_case_micros: number;
  expected_micros: number;
  per_recipient_micros: number;
  shortfall_micros: number;
  audience_fingerprint: string;
  ready: { sender: boolean; route: boolean; blocker?: CampaignBlocker };
  count: AudienceCount | null;
}

export const CAMPAIGN_BLOCKERS = ["sender_not_found", "sender_not_ready", "route_not_found", "route_not_ready", "route_invalid"] as const;
export type CampaignBlocker = (typeof CAMPAIGN_BLOCKERS)[number];

export interface AudienceConfirmation {
  count: number;
  fingerprint: string;
}

export function audienceNeedsConfirmation(audience: LeadSelection | null): boolean {
  return audience !== null && audience.mode !== "ids";
}

export function confirmationOf(estimate: Pick<CampaignEstimate, "recipients" | "audience_fingerprint">): AudienceConfirmation | null {
  return estimate.recipients > 0 && estimate.audience_fingerprint !== "" ? { count: estimate.recipients, fingerprint: estimate.audience_fingerprint } : null;
}

export function confirmedAudience(audience: LeadSelection, confirmation: AudienceConfirmation): LeadSelection {
  return { ...audience, expectedCount: confirmation.count, fingerprint: confirmation.fingerprint };
}

export function audienceAlreadyConfirmed(audience: LeadSelection, confirmation: AudienceConfirmation): boolean {
  return audience.expectedCount === confirmation.count && audience.fingerprint === confirmation.fingerprint;
}

export function emptyCampaignDraft(channel: CampaignChannel): CampaignDraft {
  return {
    name: "",
    channel,
    kind: "marketing",
    sender_id: "",
    variants: [channel === "rcs" ? { name: "", content: {}, bindings: [] } : { name: "", text: "", bindings: [] }],
    fallback: {},
    audience: null,
    scheduled_at: null,
    recurrence: null,
  };
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function nullableText(value: unknown): value is string | null {
  return value === null || value === undefined || isText(value);
}

function parseBindings(value: unknown): VariableBinding[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const out: VariableBinding[] = [];
  for (const item of value) {
    if (!isJson(item) || !isText(item.source)) return null;
    out.push(isString(item.value) ? { source: item.source as VariableBinding["source"], value: item.value } : { source: item.source as VariableBinding["source"] });
  }
  return out;
}

export function parseRecurrence(value: unknown): CampaignRecurrence | null | undefined {
  if (value === null || value === undefined) return null;
  if (!isJson(value) || !oneOf(RECURRENCE_FREQUENCIES, value.frequency) || !isText(value.time) || !isText(value.timezone)) return undefined;
  const recurrence: CampaignRecurrence = { frequency: value.frequency, time: value.time, timezone: value.timezone };
  if (value.weekdays !== undefined && value.weekdays !== null) {
    if (!Array.isArray(value.weekdays) || !value.weekdays.every((day) => isCount(day) && day <= 6)) return undefined;
    recurrence.weekdays = value.weekdays as number[];
  }
  if (value.day_of_month !== undefined && value.day_of_month !== null) {
    if (!isCount(value.day_of_month)) return undefined;
    recurrence.day_of_month = value.day_of_month;
  }
  if (isText(value.until)) recurrence.until = value.until;
  return recurrence;
}

function parseStats(value: unknown): CampaignStats | null {
  if (!isJson(value)) return null;
  const keys = ["targeted", "sent", "delivered", "read", "clicks", "replies"] as const;
  if (!keys.every((key) => isCount(value[key]))) return null;
  return Object.fromEntries(keys.map((key) => [key, value[key]])) as unknown as CampaignStats;
}

export function parseCampaignSummary(value: unknown): CampaignSummary | null {
  if (!isJson(value) || !isText(value.id) || !isString(value.name) || !isText(value.created_at)) return null;
  if (!oneOf(CAMPAIGN_CHANNELS, value.channel) || !oneOf(CAMPAIGN_STATUSES, value.status) || !oneOf(CAMPAIGN_KINDS, value.kind)) return null;
  if (!isString(value.sender_id) || !nullableText(value.scheduled_at)) return null;
  const recurrence = parseRecurrence(value.recurrence);
  const stats = parseStats(value.stats);
  if (recurrence === undefined || !stats) return null;
  return {
    id: value.id,
    name: value.name,
    channel: value.channel,
    status: value.status,
    kind: value.kind,
    sender_id: value.sender_id,
    scheduled_at: (value.scheduled_at as string | null | undefined) ?? null,
    recurrence,
    created_at: value.created_at,
    stats,
  };
}

export function parseCampaignPage(value: unknown): CampaignPage | null {
  if (!isJson(value) || !Array.isArray(value.items) || !isCount(value.total)) return null;
  const items = value.items.map(parseCampaignSummary);
  if (items.some((item) => item === null)) return null;
  return { items: items as CampaignSummary[], total: value.total };
}

function parseVariant(value: unknown): CampaignVariant | null {
  if (!isJson(value) || !isString(value.name)) return null;
  const bindings = parseBindings(value.bindings);
  if (!bindings) return null;
  const variant: CampaignVariant = { name: value.name, bindings };
  if (isJson(value.content)) variant.content = value.content as RcsContent;
  if (isString(value.text)) variant.text = value.text;
  return variant;
}

function parseFallback(value: unknown): CampaignFallback | null {
  if (value === undefined || value === null) return {};
  if (!isJson(value)) return null;
  const fallback: CampaignFallback = {};
  if (isJson(value.whatsapp)) {
    const body = parseBindings(value.whatsapp.body_bindings);
    const header = parseBindings(value.whatsapp.header_bindings);
    if (!isText(value.whatsapp.business_phone_id) || !isText(value.whatsapp.template_id) || !body || !header) return null;
    fallback.whatsapp = { business_phone_id: value.whatsapp.business_phone_id, template_id: value.whatsapp.template_id, body_bindings: body, header_bindings: header };
  }
  if (isJson(value.sms)) {
    const bindings = parseBindings(value.sms.bindings);
    if (!isText(value.sms.route_id) || !isString(value.sms.text) || !bindings) return null;
    fallback.sms = { route_id: value.sms.route_id, text: value.sms.text, bindings };
  }
  return fallback;
}

export function parseCampaign(value: unknown): Campaign | null {
  if (!isJson(value) || !isText(value.id) || !isString(value.name) || !isString(value.sender_id)) return null;
  if (!oneOf(CAMPAIGN_CHANNELS, value.channel) || !oneOf(CAMPAIGN_STATUSES, value.status) || !oneOf(CAMPAIGN_KINDS, value.kind)) return null;
  if (!Array.isArray(value.variants) || !nullableText(value.scheduled_at)) return null;
  const variants = value.variants.map(parseVariant);
  const fallback = parseFallback(value.fallback);
  const recurrence = parseRecurrence(value.recurrence);
  if (variants.some((variant) => variant === null) || !fallback || recurrence === undefined) return null;
  return {
    id: value.id,
    name: value.name,
    channel: value.channel,
    kind: value.kind,
    status: value.status,
    sender_id: value.sender_id,
    variants: variants as CampaignVariant[],
    fallback,
    audience: isJson(value.audience) && isText(value.audience.mode) ? (value.audience as unknown as LeadSelection) : null,
    scheduled_at: (value.scheduled_at as string | null | undefined) ?? null,
    recurrence,
  };
}

export function parseCampaignEstimate(value: unknown): CampaignEstimate | null {
  if (!isJson(value) || !oneOf(CAMPAIGN_CHANNELS, value.channel) || !isJson(value.ready)) return null;
  const counts = ["recipients", "messages", "worst_case_micros", "expected_micros", "per_recipient_micros", "shortfall_micros"] as const;
  if (!counts.every((key) => isCount(value[key]))) return null;
  if (typeof value.ready.sender !== "boolean" || typeof value.ready.route !== "boolean") return null;
  if (typeof value.audience_fingerprint !== "string") return null;
  const hasCount = value.count !== undefined && value.count !== null;
  const count = hasCount ? parseAudienceCount(value.count) : null;
  if (hasCount && !count) return null;
  const estimate: CampaignEstimate = {
    channel: value.channel,
    recipients: value.recipients as number,
    messages: value.messages as number,
    worst_case_micros: value.worst_case_micros as number,
    expected_micros: value.expected_micros as number,
    per_recipient_micros: value.per_recipient_micros as number,
    shortfall_micros: value.shortfall_micros as number,
    audience_fingerprint: value.audience_fingerprint,
    ready: { sender: value.ready.sender, route: value.ready.route },
    count,
  };
  if (oneOf(CAMPAIGN_BLOCKERS, value.ready.blocker)) estimate.ready.blocker = value.ready.blocker;
  if (isCount(value.worst_case_segments)) estimate.worst_case_segments = value.worst_case_segments;
  return estimate;
}
