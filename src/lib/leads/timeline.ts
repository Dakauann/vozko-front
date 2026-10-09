import { isEntryId, isEntryType, type ConversationDeepLink } from "@/lib/conversations/deep-link";
import type { Opportunity } from "@/lib/crm/opportunities";

export const LEAD_TIMELINE_KINDS = [
  "conversation",
  "campaign_sent",
  "campaign_delivered",
  "campaign_read",
  "campaign_failed",
  "call",
  "deal",
  "deal_event",
  "memory",
  "record",
] as const;

export type LeadTimelineKind = (typeof LEAD_TIMELINE_KINDS)[number];

export type LeadTimelineRefType = "entry" | "call" | "deal" | "memory" | "lead_event";

export interface LeadTimelineRef {
  type: LeadTimelineRefType;
  id: string;
  entryType?: string;
}

export interface LeadTimelineSummary {
  channel?: string;
  status?: string;
  title?: string;
  campaignId?: string;
  event?: string;
  fields?: string[];
  direction?: string;
  source?: string;
  durationSec?: number;
  answeredAt?: string;
  valueCents?: number;
  currency?: string;
  pipelineId?: string;
  stageId?: string;
  fromStageId?: string;
  stageName?: string;
  fromStageName?: string;
  category?: string;
  text?: string;
  disposition?: string;
  callbackAt?: string;
  callListId?: string;
}

export interface LeadTimelineItem {
  id: string;
  kind: LeadTimelineKind;
  at: string;
  actor?: string;
  actorName?: string;
  ref: LeadTimelineRef;
  summary: LeadTimelineSummary;
}

export interface LeadTimelinePage {
  leadId: string;
  items: LeadTimelineItem[];
  next?: string;
}

export interface LeadDealsPage {
  leadId: string;
  deals: Opportunity[];
  next?: string;
}

export const TIMELINE_AUTO_EMPTY_PAGES = 5;

const CONVERSATION_KINDS: ReadonlySet<LeadTimelineKind> = new Set([
  "conversation",
  "campaign_sent",
  "campaign_delivered",
  "campaign_read",
  "campaign_failed",
]);

const LOCATION_RECORD_EVENTS: ReadonlySet<string> = new Set(["location_pinned", "location_accepted"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKind(value: unknown): value is LeadTimelineKind {
  return typeof value === "string" && (LEAD_TIMELINE_KINDS as readonly string[]).includes(value);
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function cursorOf(value: unknown): string | undefined {
  const next = textOf(value).trim();
  return next || undefined;
}

function summaryOf(value: unknown): LeadTimelineSummary {
  const summary = isRecord(value) ? (value as LeadTimelineSummary) : {};
  const fields = Array.isArray(summary.fields) ? summary.fields.filter((field): field is string => typeof field === "string" && field !== "") : [];
  return { ...summary, fields };
}

function refOf(value: unknown): LeadTimelineRef | null {
  if (!isRecord(value)) return null;
  const type = textOf(value.type) as LeadTimelineRefType;
  if (!type) return null;
  const entryType = textOf(value.entryType);
  return { type, id: textOf(value.id), ...(entryType ? { entryType } : {}) };
}

function itemOf(value: unknown): LeadTimelineItem | null {
  if (!isRecord(value) || !isKind(value.kind)) return null;
  const id = textOf(value.id);
  const at = textOf(value.at);
  const ref = refOf(value.ref);
  if (!id || !ref || Number.isNaN(Date.parse(at))) return null;
  const actor = textOf(value.actor);
  const actorName = textOf(value.actorName);
  return {
    id,
    kind: value.kind,
    at,
    ...(actor ? { actor } : {}),
    ...(actorName ? { actorName } : {}),
    ref,
    summary: summaryOf(value.summary),
  };
}

export function readTimelinePage(value: unknown): LeadTimelinePage | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const items = value.items.map(itemOf).filter((entry): entry is LeadTimelineItem => entry !== null);
  const next = cursorOf(value.next);
  return { leadId: textOf(value.leadId), items, ...(next ? { next } : {}) };
}

export function readDealsPage(value: unknown): LeadDealsPage | null {
  if (!isRecord(value) || !Array.isArray(value.deals)) return null;
  const deals = value.deals.filter((deal): deal is Opportunity => isRecord(deal) && textOf(deal.id) !== "");
  const next = cursorOf(value.next);
  return { leadId: textOf(value.leadId), deals, ...(next ? { next } : {}) };
}

function uniqueById<T extends { id: string }>(lists: readonly (readonly T[])[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const list of lists) {
    for (const entry of list) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      out.push(entry);
    }
  }
  return out;
}

export function timelineItemsOf(pages: readonly LeadTimelinePage[] | undefined): LeadTimelineItem[] {
  return uniqueById((pages ?? []).map((page) => page.items));
}

export function dealsOf(pages: readonly LeadDealsPage[] | undefined): Opportunity[] {
  return uniqueById((pages ?? []).map((page) => page.deals));
}

export function timelineEntryLink(item: LeadTimelineItem): ConversationDeepLink | null {
  if (!CONVERSATION_KINDS.has(item.kind) || item.ref.type !== "entry") return null;
  const entryType = item.ref.entryType ?? "";
  if (!isEntryType(entryType) || !isEntryId(item.ref.id)) return null;
  return { entryId: item.ref.id, entryType };
}

export function isLocationEvent(item: LeadTimelineItem): boolean {
  return item.kind === "record" && LOCATION_RECORD_EVENTS.has(item.summary.event ?? "");
}

export function autoLoadsNextPage(pageSizes: readonly number[]): boolean {
  let emptyInARow = 0;
  for (let index = pageSizes.length - 1; index >= 0 && pageSizes[index] === 0; index -= 1) emptyInARow += 1;
  return emptyInARow < TIMELINE_AUTO_EMPTY_PAGES;
}
