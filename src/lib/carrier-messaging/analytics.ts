import { oneOf } from "@/lib/carrier-messaging/parse";
import { CAMPAIGN_CHANNELS, RECIPIENT_STATUSES, type CampaignChannel, type RecipientStatus } from "@/lib/carrier-messaging/campaigns";
import { isCount, isJson, isText } from "@/lib/json/guards";
import { RCS_SUGGESTION_KINDS, type RcsSuggestionKind } from "@/lib/rcs/types";

export const OVERVIEW_DAYS = [7, 30, 90] as const;
export type OverviewDays = (typeof OVERVIEW_DAYS)[number];

export const OVERVIEW_CHANNELS = ["all", "rcs", "sms"] as const;
export type OverviewChannel = (typeof OVERVIEW_CHANNELS)[number];

export const SPEND_CHANNELS = ["rcs", "sms", "whatsapp"] as const;
export type SpendChannel = (typeof SPEND_CHANNELS)[number];

export const RECIPIENTS_PAGE_LIMIT = { default: 50, max: 100 } as const;

export const TIMELINE_BUCKETS = ["minute", "hour", "day"] as const;
export type TimelineBucket = (typeof TIMELINE_BUCKETS)[number];

export const FUNNEL_TOTAL_KEYS = [
  "sent",
  "delivered",
  "read",
  "failed",
  "taps",
  "clicks",
  "replies",
  "opt_outs",
  "fell_back_whatsapp",
  "fell_back_sms",
  "conversions",
  "conversion_value_micros",
  "spend_micros",
] as const;
export type FunnelTotals = Record<(typeof FUNNEL_TOTAL_KEYS)[number], number>;

export const RUN_FUNNEL_KEYS = ["targeted", "skipped", "accepted", "rejected", "expired"] as const;
export type RunFunnel = FunnelTotals & Record<(typeof RUN_FUNNEL_KEYS)[number], number>;

export const RATE_KEYS = ["delivery", "read", "tap_through", "click_through", "reply", "opt_out", "fallback", "conversion"] as const;
export type FunnelRates = Record<(typeof RATE_KEYS)[number], number | null> & { cost_per_conversion_micros: number | null };

export interface DailyPoint {
  day: string;
  channel: CampaignChannel;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  spend_micros: number;
}

export interface ChannelSpend {
  channel: SpendChannel;
  spend_micros: number;
  conversions: number;
  cost_per_conversion_micros: number | null;
}

export interface CarrierStat {
  operator: string;
  sent: number;
  delivered: number;
  fell_back: number;
  fallback_rate: number | null;
}

export interface Overview {
  totals: FunnelTotals;
  rates: FunnelRates;
  daily: DailyPoint[];
  channels: ChannelSpend[];
  carriers: CarrierStat[];
}

export interface CampaignFunnel {
  funnel: RunFunnel;
  rates: FunnelRates;
}

export interface VariantStat {
  variant: number;
  name: string;
  funnel: RunFunnel;
  rates: FunnelRates;
}

export interface ButtonStat {
  card: number;
  index: number;
  label: string;
  kind: RcsSuggestionKind;
  taps: number;
  clicks: number;
}

export interface TimelinePoint {
  at: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface CampaignTimeline {
  bucket: TimelineBucket;
  points: TimelinePoint[];
}

export interface CampaignRecipient {
  phone: string;
  lead_id: string;
  lead_name: string;
  variant: number;
  status: RecipientStatus;
  skip_reason: string;
  message_status: string;
  updated_at: string;
}

export interface RecipientPage {
  items: CampaignRecipient[];
  total: number;
}

function isRate(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && value >= 0 && value <= 1);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function countsOf<K extends string>(value: unknown, keys: readonly K[]): Record<K, number> | null {
  if (!isJson(value) || !keys.every((key) => isCount(value[key]))) return null;
  return Object.fromEntries(keys.map((key) => [key, value[key]])) as Record<K, number>;
}

export function parseRates(value: unknown): FunnelRates | null {
  if (!isJson(value) || !RATE_KEYS.every((key) => isRate(value[key] ?? null))) return null;
  const cost = value.cost_per_conversion_micros ?? null;
  if (cost !== null && !isCount(cost)) return null;
  return { ...Object.fromEntries(RATE_KEYS.map((key) => [key, value[key] ?? null])), cost_per_conversion_micros: cost } as FunnelRates;
}

function parseList<T>(value: unknown, item: (value: unknown) => T | null): T[] | null {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const out = value.map(item);
  return out.some((entry) => entry === null) ? null : (out as T[]);
}

function parseDaily(value: unknown): DailyPoint | null {
  if (!isJson(value) || !isText(value.day) || !oneOf(CAMPAIGN_CHANNELS, value.channel)) return null;
  const counts = countsOf(value, ["sent", "delivered", "read", "failed", "spend_micros"] as const);
  return counts ? { day: value.day, channel: value.channel, ...counts } : null;
}

function parseChannelSpend(value: unknown): ChannelSpend | null {
  if (!isJson(value) || !oneOf(SPEND_CHANNELS, value.channel) || !isCount(value.spend_micros) || !isCount(value.conversions)) return null;
  const cost = value.cost_per_conversion_micros ?? null;
  if (cost !== null && !isCount(cost)) return null;
  return { channel: value.channel, spend_micros: value.spend_micros, conversions: value.conversions, cost_per_conversion_micros: cost };
}

export function parseCarrierStat(value: unknown): CarrierStat | null {
  if (!isJson(value) || typeof value.operator !== "string") return null;
  const counts = countsOf(value, ["sent", "delivered", "fell_back"] as const);
  const rate = value.fallback_rate ?? null;
  if (!counts || !isRate(rate)) return null;
  return { operator: value.operator, ...counts, fallback_rate: rate };
}

export function parseCarrierStats(value: unknown): CarrierStat[] | null {
  return parseList(value, parseCarrierStat);
}

export function parseOverview(value: unknown): Overview | null {
  if (!isJson(value)) return null;
  const totals = countsOf(value.totals, FUNNEL_TOTAL_KEYS);
  const rates = parseRates(value.rates);
  const daily = parseList(value.daily, parseDaily);
  const channels = parseList(value.channels, parseChannelSpend);
  const carriers = parseCarrierStats(value.carriers);
  if (!totals || !rates || !daily || !channels || !carriers) return null;
  return { totals, rates, daily, channels, carriers };
}

function parseRunFunnel(value: unknown): RunFunnel | null {
  return countsOf(value, [...FUNNEL_TOTAL_KEYS, ...RUN_FUNNEL_KEYS]);
}

export function parseCampaignFunnel(value: unknown): CampaignFunnel | null {
  if (!isJson(value)) return null;
  const funnel = parseRunFunnel(value.funnel);
  const rates = parseRates(value.rates);
  return funnel && rates ? { funnel, rates } : null;
}

function parseVariantStat(value: unknown): VariantStat | null {
  if (!isJson(value) || !isCount(value.variant) || typeof value.name !== "string") return null;
  const funnel = parseRunFunnel(value.funnel);
  const rates = parseRates(value.rates);
  return funnel && rates ? { variant: value.variant, name: value.name, funnel, rates } : null;
}

export function parseVariantStats(value: unknown): VariantStat[] | null {
  return parseList(value, parseVariantStat);
}

function parseButtonStat(value: unknown): ButtonStat | null {
  if (!isJson(value) || !isInteger(value.card) || value.card < -1 || !isCount(value.index)) return null;
  if (typeof value.label !== "string" || !oneOf(RCS_SUGGESTION_KINDS, value.kind) || !isCount(value.taps) || !isCount(value.clicks)) return null;
  return { card: value.card, index: value.index, label: value.label, kind: value.kind, taps: value.taps, clicks: value.clicks };
}

export function parseButtonStats(value: unknown): ButtonStat[] | null {
  return parseList(value, parseButtonStat);
}

function parseTimelinePoint(value: unknown): TimelinePoint | null {
  if (!isJson(value) || !isText(value.at)) return null;
  const counts = countsOf(value, ["sent", "delivered", "read", "failed"] as const);
  return counts ? { at: value.at, ...counts } : null;
}

export function parseCampaignTimeline(value: unknown): CampaignTimeline | null {
  if (!isJson(value) || !oneOf(TIMELINE_BUCKETS, value.bucket)) return null;
  const points = parseList(value.points, parseTimelinePoint);
  return points ? { bucket: value.bucket, points } : null;
}

function parseRecipient(value: unknown): CampaignRecipient | null {
  if (!isJson(value) || !isText(value.phone) || !oneOf(RECIPIENT_STATUSES, value.status) || !isCount(value.variant) || !isText(value.updated_at)) return null;
  const texts = ["lead_id", "lead_name", "skip_reason", "message_status"] as const;
  if (!texts.every((key) => typeof (value[key] ?? "") === "string")) return null;
  return {
    phone: value.phone,
    lead_id: (value.lead_id as string | undefined) ?? "",
    lead_name: (value.lead_name as string | undefined) ?? "",
    variant: value.variant,
    status: value.status,
    skip_reason: (value.skip_reason as string | undefined) ?? "",
    message_status: (value.message_status as string | undefined) ?? "",
    updated_at: value.updated_at,
  };
}

export function parseRecipientPage(value: unknown): RecipientPage | null {
  if (!isJson(value) || !isCount(value.total)) return null;
  const items = parseList(value.items, parseRecipient);
  return items ? { items, total: value.total } : null;
}
