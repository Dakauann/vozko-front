import { CALL_OUTCOMES, type CallOutcome } from "@/lib/call-history/types";
import { LEAD_PHONE_LABELS, type LeadPhoneLabel } from "@/lib/leads/types";

export const CALL_LIST_STATUSES = ["building", "active", "paused", "archived", "failed"] as const;
export const CALL_LIST_ITEM_STATES = ["pending", "reserved", "closed"] as const;
export const CALL_LIST_PHONE_SOURCES = ["identity", "contact"] as const;
export const CALL_LIST_TRUNK_REFUSALS = ["unauthorized", "no_dialable_trunk"] as const;
export const CALL_LIST_SKIP_REASONS = [
  "blocked",
  "opted_out",
  "no_number",
  "number_not_held",
  "invalid_number",
  "gone",
] as const;
export const CALL_LIST_FAILURES = ["no_callable_lead", "build_failed"] as const;

export const CALLBACK_DISPOSITION = "_callback";
export const REFUSED_DISPOSITION = "_refused";

export type CallListStatus = (typeof CALL_LIST_STATUSES)[number];
export type CallListItemState = (typeof CALL_LIST_ITEM_STATES)[number];
export type CallListPhoneSource = (typeof CALL_LIST_PHONE_SOURCES)[number];
export type CallListTrunkRefusal = (typeof CALL_LIST_TRUNK_REFUSALS)[number];

export interface CallListPhoneChoice {
  source: CallListPhoneSource;
  label?: LeadPhoneLabel;
}

export interface CallList {
  id: string;
  name: string;
  status: CallListStatus;
  createdBy: string;
  assigneeIds: string[];
  phone: CallListPhoneChoice;
  selected: number;
  itemCount: number;
  closedCount: number;
  openCount: number;
  calledCount: number;
  callbackCount: number;
  acceptsOutcomes: boolean;
  statusMoves: CallListStatus[];
  skipped: Record<string, number>;
  failureCode?: string;
  builtAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallListPage {
  items: CallList[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CallListItem {
  id: string;
  listId: string;
  leadId: string;
  leadName?: string;
  leadDistrict?: string;
  leadCity?: string;
  phone: string;
  position: number;
  state: CallListItemState;
  reservedBy?: string;
  reservedUntil?: string;
  disposition?: string;
  note?: string;
  refusal?: string;
  callbackAt?: string;
  lastCallId?: string;
  outcome?: CallOutcome;
  attempts?: number;
  closedBy?: string;
  closedAt?: string;
  closable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CallListItemsCursor {
  after: number;
  afterAt?: string;
  asOf?: string;
}

export interface CallListItemPage {
  items: CallListItem[];
  next?: CallListItemsCursor;
}

export interface CallListLeadCard {
  id: string;
  name?: string;
  district?: string;
  city?: string;
  familyCount: number;
}

export interface CallListInteraction {
  entryId: string;
  entryType: string;
  at: string;
}

export interface CallListTrunk {
  id: string;
  name: string;
}

export interface CallListNext {
  list: CallList;
  item?: CallListItem;
  lead?: CallListLeadCard;
  lastInteraction?: CallListInteraction;
  trunks: CallListTrunk[];
  trunkRefusal?: CallListTrunkRefusal;
  refused: number;
  more: boolean;
}

export interface CallListChange {
  name?: string;
  assigneeIds?: string[];
  status?: Extract<CallListStatus, "active" | "paused" | "archived">;
}

export interface CallListClosing {
  disposition: string;
  note?: string;
  callbackAt?: string;
}

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function optional(value: unknown): string | undefined {
  return isText(value) && value !== "" ? value : undefined;
}

function withOptional<T extends Json>(base: T, extra: Json): T {
  const out: Json = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

function skipsOf(value: unknown): Record<string, number> | null {
  if (value === undefined || value === null) return {};
  if (!isJson(value)) return null;
  const skips: Record<string, number> = {};
  for (const [reason, count] of Object.entries(value)) {
    if (!isCount(count)) return null;
    skips[reason] = count;
  }
  return skips;
}

function phoneOf(value: unknown): CallListPhoneChoice | null {
  if (!isJson(value) || !oneOf(CALL_LIST_PHONE_SOURCES, value.source)) return null;
  if (value.label === undefined || value.label === "") return { source: value.source };
  return oneOf(LEAD_PHONE_LABELS, value.label) ? { source: value.source, label: value.label } : null;
}

export function parseCallList(value: unknown): CallList | null {
  if (!isJson(value) || !isText(value.id) || !isText(value.name) || !isText(value.createdBy)) return null;
  if (!oneOf(CALL_LIST_STATUSES, value.status)) return null;
  if (!Array.isArray(value.assigneeIds) || !value.assigneeIds.every(isText)) return null;
  const { selected, itemCount, closedCount, openCount, calledCount, callbackCount } = value;
  if (!isCount(selected) || !isCount(itemCount) || !isCount(closedCount) || !isCount(openCount)) return null;
  if (!isCount(calledCount) || !isCount(callbackCount) || typeof value.acceptsOutcomes !== "boolean") return null;
  if (!Array.isArray(value.statusMoves) || !value.statusMoves.every((move) => oneOf(CALL_LIST_STATUSES, move))) return null;
  const phone = phoneOf(value.phone);
  const skipped = skipsOf(value.skipped);
  if (!phone || !skipped || !isText(value.createdAt) || !isText(value.updatedAt)) return null;
  return withOptional(
    {
      id: value.id,
      name: value.name,
      status: value.status,
      createdBy: value.createdBy,
      assigneeIds: [...value.assigneeIds],
      phone,
      selected,
      itemCount,
      closedCount,
      openCount,
      calledCount,
      callbackCount,
      acceptsOutcomes: value.acceptsOutcomes,
      statusMoves: [...value.statusMoves] as CallListStatus[],
      skipped,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    },
    {
      failureCode: optional(value.failureCode),
      builtAt: optional(value.builtAt),
    },
  );
}

function listOf<T>(value: unknown, parse: (entry: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const entry of value) {
    const parsed = parse(entry);
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}

export function parseCallListPage(value: unknown): CallListPage | null {
  if (!isJson(value) || !isCount(value.total) || !isCount(value.page) || !isCount(value.pageSize)) return null;
  const items = listOf(value.items, parseCallList);
  return items ? { items, total: value.total, page: value.page, pageSize: value.pageSize } : null;
}

export function parseCallListItem(value: unknown): CallListItem | null {
  if (!isJson(value) || !isText(value.id) || !isText(value.listId) || !isText(value.leadId) || !isText(value.phone)) return null;
  if (!isCount(value.position) || !oneOf(CALL_LIST_ITEM_STATES, value.state)) return null;
  if (!isText(value.createdAt) || !isText(value.updatedAt)) return null;
  if (value.outcome !== undefined && value.outcome !== "" && !oneOf(CALL_OUTCOMES, value.outcome)) return null;
  if (value.attempts !== undefined && !isCount(value.attempts)) return null;
  if (typeof value.closable !== "boolean") return null;
  return withOptional(
    {
      id: value.id,
      listId: value.listId,
      leadId: value.leadId,
      phone: value.phone,
      position: value.position,
      state: value.state,
      closable: value.closable,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    },
    {
      leadName: optional(value.leadName),
      leadDistrict: optional(value.leadDistrict),
      leadCity: optional(value.leadCity),
      reservedBy: optional(value.reservedBy),
      reservedUntil: optional(value.reservedUntil),
      disposition: optional(value.disposition),
      note: optional(value.note),
      refusal: optional(value.refusal),
      callbackAt: optional(value.callbackAt),
      lastCallId: optional(value.lastCallId),
      outcome: oneOf(CALL_OUTCOMES, value.outcome) ? value.outcome : undefined,
      attempts: isCount(value.attempts) ? value.attempts : undefined,
      closedBy: optional(value.closedBy),
      closedAt: optional(value.closedAt),
    },
  );
}

export function parseCallListItemPage(value: unknown): CallListItemPage | null {
  if (!isJson(value)) return null;
  const items = listOf(value.items, parseCallListItem);
  if (!items) return null;
  if (!isCount(value.next) || value.next === 0) return { items };
  const next: CallListItemsCursor = withOptional({ after: value.next }, { afterAt: optional(value.nextAt), asOf: optional(value.asOf) });
  return { items, next };
}

export function encodeItemsCursor(cursor: CallListItemsCursor): string {
  return JSON.stringify(cursor);
}

export function decodeItemsCursor(raw: string | undefined): CallListItemsCursor | undefined {
  if (!raw) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isJson(value) || !isCount(value.after) || value.after === 0) return undefined;
  return withOptional({ after: value.after }, { afterAt: optional(value.afterAt), asOf: optional(value.asOf) });
}

function leadCardOf(value: unknown): CallListLeadCard | null {
  if (!isJson(value) || !isText(value.id) || !isCount(value.familyCount)) return null;
  return withOptional(
    { id: value.id, familyCount: value.familyCount },
    { name: optional(value.name), district: optional(value.district), city: optional(value.city) },
  );
}

function interactionOf(value: unknown): CallListInteraction | null {
  if (!isJson(value) || !isText(value.entryId) || !isText(value.entryType) || !isText(value.at)) return null;
  return { entryId: value.entryId, entryType: value.entryType, at: value.at };
}

function trunkOf(value: unknown): CallListTrunk | null {
  return isJson(value) && isText(value.id) && isText(value.name) ? { id: value.id, name: value.name } : null;
}

export function parseCallListNext(value: unknown): CallListNext | null {
  if (!isJson(value) || !isCount(value.refused) || typeof value.more !== "boolean") return null;
  const list = parseCallList(value.list);
  const trunks = listOf(value.trunks ?? [], trunkOf);
  if (!list || !trunks) return null;
  if (value.trunkRefusal !== undefined && value.trunkRefusal !== "" && !oneOf(CALL_LIST_TRUNK_REFUSALS, value.trunkRefusal)) return null;
  const base: CallListNext = withOptional(
    { list, trunks, refused: value.refused, more: value.more },
    { trunkRefusal: oneOf(CALL_LIST_TRUNK_REFUSALS, value.trunkRefusal) ? value.trunkRefusal : undefined },
  );
  if (value.item === undefined || value.item === null) return base;
  const item = parseCallListItem(value.item);
  const lead = leadCardOf(value.lead);
  if (!item || !lead) return null;
  const lastInteraction = value.lastInteraction === undefined || value.lastInteraction === null ? undefined : interactionOf(value.lastInteraction);
  if (lastInteraction === null) return null;
  return withOptional({ ...base, item, lead }, { lastInteraction });
}
