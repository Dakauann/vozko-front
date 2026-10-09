import type { CapabilityDecision } from "@/lib/access/decide";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { READY, firstBlocker, type ActionState } from "@/lib/selection/action-state";
import type { UnofficialWhatsAppMessageSpec } from "@/lib/unofficial-whatsapp-campaigns/types";

export type LeadSendAction = "send_template" | "send_unofficial";

export type LeadSendChannel = "official" | "unofficial";

export const LEAD_FIELD_SOURCES = {
  "lead.first_name": "firstName",
  "lead.name": "name",
  "lead.nickname": "nickname",
  "lead.district": "district",
  "lead.city": "city",
  "lead.owner_name": "ownerName",
} as const;

export type LeadFieldSource = keyof typeof LEAD_FIELD_SOURCES;

export const LITERAL_SOURCE = "literal";

const CUSTOM_SOURCE_PREFIX = "lead.custom:";

export type BindingSource = typeof LITERAL_SOURCE | LeadFieldSource | `lead.custom:${string}`;

export interface VariableBinding {
  source: BindingSource;
  value?: string;
}

export interface BindingChoice {
  source: BindingSource;
  field?: CustomFieldDefinition;
}

export function customSource(key: string): BindingSource {
  return `${CUSTOM_SOURCE_PREFIX}${key}`;
}

export function bindingFieldKey(source: string): string | null {
  return source.startsWith(CUSTOM_SOURCE_PREFIX) ? source.slice(CUSTOM_SOURCE_PREFIX.length) : null;
}

export function bindingChoices(fields: readonly CustomFieldDefinition[]): BindingChoice[] {
  const leadFields = (Object.keys(LEAD_FIELD_SOURCES) as LeadFieldSource[]).map((source) => ({ source }));
  const custom = fields
    .filter((definition) => definition.readable === true && !definition.sensitive)
    .map((definition) => ({ source: customSource(definition.key), field: definition }));
  return [{ source: LITERAL_SOURCE }, ...leadFields, ...custom];
}

const EMPTY_LITERAL: VariableBinding = { source: LITERAL_SOURCE, value: "" };

export function defaultBindings(slots: number): VariableBinding[] {
  return Array.from({ length: slots }, (_, index) => (index === 0 ? { source: "lead.first_name" } : { ...EMPTY_LITERAL }));
}

export function sizedBindings(bindings: readonly VariableBinding[], slots: number): VariableBinding[] {
  return Array.from({ length: slots }, (_, index) => bindings[index] ?? { ...EMPTY_LITERAL });
}

function bindingReady(binding: VariableBinding | undefined): boolean {
  if (!binding || !binding.source) return false;
  return binding.source !== LITERAL_SOURCE || (binding.value ?? "").trim() !== "";
}

export function bindingsReady(bindings: readonly VariableBinding[], slots: number): boolean {
  return bindings.length === slots && bindings.every(bindingReady);
}

function cleanBindings(bindings: readonly VariableBinding[]): VariableBinding[] {
  return bindings.map((binding) =>
    binding.source === LITERAL_SOURCE ? { source: LITERAL_SOURCE, value: (binding.value ?? "").trim() } : { source: binding.source },
  );
}

export function bindingPreviewValues(bindings: readonly VariableBinding[], labelOf: (source: BindingSource) => string): string[] {
  return bindings.map((binding) =>
    binding.source === LITERAL_SOURCE ? (binding.value ?? "").trim() : `[${labelOf(binding.source)}]`,
  );
}

export interface LeadSendParams {
  name: string;
  departmentId?: string;
  split?: boolean;
  businessPhoneId?: string;
  templateId?: string;
  instanceId?: string;
  message?: UnofficialWhatsAppMessageSpec;
  sendDelayMinMs?: number;
  sendDelayMaxMs?: number;
  dailyCap?: number;
  bindings?: VariableBinding[];
}

interface SendDraftBase {
  name: string;
  departmentId: string;
  departmentRequired: boolean;
  split: boolean;
  bindings: readonly VariableBinding[];
  slots: number;
}

export interface TemplateSendDraft extends SendDraftBase {
  businessPhoneId: string;
  templateId: string;
}

export interface MessageSendDraft extends SendDraftBase {
  instanceId: string;
  message: UnofficialWhatsAppMessageSpec;
  sendDelayMinMs: number;
  sendDelayMaxMs: number;
  dailyCap: number;
}

function baseParams(draft: SendDraftBase): LeadSendParams | null {
  const name = draft.name.trim();
  const departmentId = draft.departmentId.trim();
  if (!name || (draft.departmentRequired && !departmentId)) return null;
  if (!bindingsReady(draft.bindings, draft.slots)) return null;
  return {
    name,
    ...(departmentId ? { departmentId } : {}),
    ...(draft.split ? { split: true } : {}),
  };
}

function withBindings(params: LeadSendParams, bindings: readonly VariableBinding[]): LeadSendParams {
  return bindings.length > 0 ? { ...params, bindings: cleanBindings(bindings) } : params;
}

export function templateSendParams(draft: TemplateSendDraft): LeadSendParams | null {
  const base = baseParams(draft);
  if (!base || !draft.businessPhoneId || !draft.templateId) return null;
  return withBindings({ ...base, businessPhoneId: draft.businessPhoneId, templateId: draft.templateId }, draft.bindings);
}

function positive(value: number): number | undefined {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

export function messageSendParams(draft: MessageSendDraft, messageReady: boolean): LeadSendParams | null {
  const base = baseParams(draft);
  if (!base || !messageReady || !draft.instanceId) return null;
  const pacing = {
    sendDelayMinMs: positive(draft.sendDelayMinMs),
    sendDelayMaxMs: positive(draft.sendDelayMaxMs),
    dailyCap: positive(draft.dailyCap),
  };
  const set = Object.fromEntries(Object.entries(pacing).filter(([, value]) => value !== undefined));
  return withBindings({ ...base, instanceId: draft.instanceId, message: draft.message, ...set }, draft.bindings);
}

export function sendChannelOf(action: LeadSendAction): LeadSendChannel {
  return action === "send_template" ? "official" : "unofficial";
}

export interface SendQuote {
  count: number;
  parts: number;
  splitRequired: boolean;
  maxPerCampaign: number;
  category?: string;
  unitPriceMicros: number;
  costMicros: number;
  balanceMicros: number;
  currency?: string;
  affordable: boolean;
  capRemaining?: number;
  fits: number;
  refusal?: string;
  dailyCap?: number;
  estimatedDays?: number;
}

export interface SendPart {
  campaignId: string;
  name: string;
  status: string;
  entries: number;
  eligible: number;
}

export interface SendMissingVariable {
  slot: number;
  source?: string;
  count: number;
}

export interface SendReview {
  channel: LeadSendChannel;
  parts: SendPart[];
  entries: number;
  eligible: number;
  skipped: Record<string, number>;
  counted: Record<string, number>;
  missingVariables: SendMissingVariable[];
  cooldownDays?: number;
  quote: SendQuote;
  started: boolean;
}

export interface LeadSendRequest {
  channel: LeadSendChannel;
  campaignIds: string[];
  firstN?: number;
}

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function optional<T>(value: unknown, check: (value: unknown) => value is T): T | undefined | null {
  if (value === undefined || value === null) return undefined;
  return check(value) ? value : null;
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

export function parseReasonCounts(value: unknown): Record<string, number> | null {
  if (value === undefined || value === null) return {};
  if (!isJson(value)) return null;
  const counts: Record<string, number> = {};
  for (const [reason, count] of Object.entries(value)) {
    if (!isCount(count)) return null;
    counts[reason] = count;
  }
  return counts;
}

export function parseSendQuote(value: unknown): SendQuote | null {
  if (!isJson(value)) return null;
  const { count, parts, maxPerCampaign, unitPriceMicros, costMicros, balanceMicros, fits } = value;
  if (!isCount(count) || !isCount(parts) || !isCount(maxPerCampaign) || !isCount(fits)) return null;
  if (!isCount(unitPriceMicros) || !isCount(costMicros) || !isAmount(balanceMicros)) return null;
  if (typeof value.splitRequired !== "boolean" || typeof value.affordable !== "boolean") return null;
  const category = optional(value.category, isText);
  const currency = optional(value.currency, isText);
  const refusal = optional(value.refusal, isText);
  const capRemaining = optional(value.capRemaining, isAmount);
  const dailyCap = optional(value.dailyCap, isCount);
  const estimatedDays = optional(value.estimatedDays, isCount);
  if ([category, currency, refusal, capRemaining, dailyCap, estimatedDays].includes(null)) return null;
  const quote: SendQuote = {
    count,
    parts,
    splitRequired: value.splitRequired,
    maxPerCampaign,
    unitPriceMicros,
    costMicros,
    balanceMicros,
    affordable: value.affordable,
    fits,
  };
  const extras = { category, currency, refusal, capRemaining, dailyCap, estimatedDays };
  for (const [key, extra] of Object.entries(extras)) {
    if (extra !== undefined) (quote as unknown as Json)[key] = extra;
  }
  return quote;
}

export function parseSendPart(value: unknown): SendPart | null {
  if (!isJson(value) || typeof value.campaignId !== "string" || !value.campaignId) return null;
  if (typeof value.name !== "string" || typeof value.status !== "string") return null;
  if (!isCount(value.entries) || !isCount(value.eligible)) return null;
  return { campaignId: value.campaignId, name: value.name, status: value.status, entries: value.entries, eligible: value.eligible };
}

function isSlot(value: unknown): value is number {
  return isCount(value) && value > 0;
}

function parseMissingVariable(value: unknown): SendMissingVariable | null {
  if (!isJson(value) || !isSlot(value.slot) || !isCount(value.count)) return null;
  if (value.source === undefined || value.source === null) return { slot: value.slot, count: value.count };
  if (typeof value.source !== "string" || value.source === "") return null;
  return { slot: value.slot, source: value.source, count: value.count };
}

export function parseMissingVariables(value: unknown): SendMissingVariable[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const parsed = value.map(parseMissingVariable);
  return parsed.some((item) => item === null) ? null : (parsed as SendMissingVariable[]);
}

export function parseSendReview(value: unknown): SendReview | null {
  if (!isJson(value)) return null;
  if (value.channel !== "official" && value.channel !== "unofficial") return null;
  if (!Array.isArray(value.parts) || value.parts.length === 0) return null;
  const parts = value.parts.map(parseSendPart);
  if (parts.some((part) => part === null)) return null;
  if (!isCount(value.entries) || !isCount(value.eligible) || typeof value.started !== "boolean") return null;
  const skipped = parseReasonCounts(value.skipped);
  const counted = parseReasonCounts(value.counted);
  const missingVariables = parseMissingVariables(value.missingVariables);
  const cooldownDays = optional(value.cooldownDays, isSlot);
  const quote = parseSendQuote(value.quote);
  if (!skipped || !counted || !missingVariables || cooldownDays === null || !quote) return null;
  return {
    channel: value.channel,
    parts: parts as SendPart[],
    entries: value.entries,
    eligible: value.eligible,
    skipped,
    counted,
    missingVariables,
    ...(cooldownDays === undefined ? {} : { cooldownDays }),
    quote,
    started: value.started,
  };
}

export const SEND_SKIP_REASONS = [
  "no_identity",
  "blocked",
  "opted_out",
  "cooldown",
  "missing_variable",
  "already_in_running_campaign",
  "over_cap",
] as const;

export const SEND_COUNTED_REASONS = ["window_open", "no_consent_recorded"] as const;

export interface SendSkipRow {
  reason: string;
  count: number;
}

export function reasonRows(counts: Record<string, number>, known: readonly string[]): SendSkipRow[] {
  const ordered = known.map((reason) => ({ reason, count: counts[reason] ?? 0 }));
  const others = Object.entries(counts)
    .filter(([reason]) => !known.includes(reason))
    .map(([reason, count]) => ({ reason, count }));
  return [...ordered, ...others].filter((row) => row.count > 0);
}

const COOLDOWN = "cooldown";
const MISSING_VARIABLE = "missing_variable";

export interface SendSlotRef {
  slot: number;
  source?: string;
}

export interface SendReviewSkipRow extends SendSkipRow {
  days?: number;
  slot?: SendSlotRef;
  nested?: boolean;
}

function slotRef({ slot, source }: SendMissingVariable): SendSlotRef {
  return source === undefined ? { slot } : { slot, source };
}

function missingVariableRows(total: number, missing: readonly SendMissingVariable[]): SendReviewSkipRow[] {
  const slots = missing.filter((item) => item.count > 0);
  if (slots.length === 1 && slots[0].count === total) return [{ reason: MISSING_VARIABLE, count: total, slot: slotRef(slots[0]) }];
  return [
    { reason: MISSING_VARIABLE, count: total },
    ...slots.map((item) => ({ reason: MISSING_VARIABLE, count: item.count, slot: slotRef(item), nested: true })),
  ];
}

export function reviewSkipRows(review: SendReview): SendReviewSkipRow[] {
  return reasonRows(review.skipped, SEND_SKIP_REASONS).flatMap((row): SendReviewSkipRow[] => {
    if (row.reason === COOLDOWN && review.cooldownDays !== undefined) return [{ ...row, days: review.cooldownDays }];
    if (row.reason === MISSING_VARIABLE) return missingVariableRows(row.count, review.missingVariables);
    return [row];
  });
}

export function countedRows(counted: Record<string, number>): SendSkipRow[] {
  return SEND_COUNTED_REASONS.map((reason) => ({ reason, count: counted[reason] ?? 0 })).filter((row) => row.count > 0);
}

export function sendRequestOf(review: SendReview, firstN?: number): LeadSendRequest {
  const campaignIds = review.parts.map((part) => part.campaignId);
  return firstN && firstN > 0 ? { channel: review.channel, campaignIds, firstN } : { channel: review.channel, campaignIds };
}

export type SendBudgetView =
  | { kind: "fits" }
  | { kind: "partial"; fits: number; refusal: string }
  | { kind: "blocked"; refusal: string };

const PRICING_UNAVAILABLE = "send_pricing_unavailable";
const NOTHING_ELIGIBLE = "send_nothing_eligible";

const BALANCE_CURRENCY = "USD";

export function quoteCurrency(quote: SendQuote): string {
  return quote.currency || BALANCE_CURRENCY;
}

export function sendBudgetView(review: Pick<SendReview, "eligible" | "quote">): SendBudgetView {
  if (review.eligible <= 0) return { kind: "blocked", refusal: NOTHING_ELIGIBLE };
  const { refusal, fits } = review.quote;
  if (!refusal) return { kind: "fits" };
  if (refusal === PRICING_UNAVAILABLE || fits <= 0) return { kind: "blocked", refusal };
  return { kind: "partial", fits, refusal };
}

export const LEAD_SEND_ERROR_CODES = [
  "forbidden",
  "send_creation_scope_missing",
  "send_department_forbidden",
  "send_department_required",
  "send_header_variable_unsupported",
  "send_named_parameters_unsupported",
  "send_bindings_mismatch",
  "send_binding_unknown",
  "send_binding_literal_empty",
  "send_binding_field_unknown",
  "send_binding_sensitive",
  "send_first_n_invalid",
  "send_incomplete",
  "send_not_from_selection",
  "send_message_invalid",
  "send_selection_empty",
  "send_selection_over_campaign_cap",
  "send_selection_too_large",
  "send_nothing_eligible",
  "send_already_started",
  "send_selection_locked",
  "send_start_from_leads",
  "send_preparing",
  "send_template_unavailable",
  "send_template_phone_mismatch",
  "send_phone_unavailable",
  "send_instance_unavailable",
  "send_campaign_not_found",
  "send_pricing_unavailable",
  "unaffordable",
  "over_cap",
  "NO_ACTIVE_SUBSCRIPTION",
  "lead_sends_unavailable",
  "campaign_automation_unavailable",
  "campaign_idempotency_unavailable",
  "campaign_lead_targets_unavailable",
  "lead_action_send_params_required",
  "lead_action_send_phone_required",
  "lead_action_send_template_required",
  "lead_action_send_instance_required",
  "lead_action_send_message_required",
  "lead_action_send_pacing_invalid",
  "timeout",
] as const;

export type LeadSendBlocker =
  | "checkingAccess"
  | "permissionSendTemplate"
  | "permissionSendUnofficial"
  | "checkingNumbers"
  | "numbersUnavailable"
  | "noOfficialNumber"
  | "noUnofficialNumber";

export type SendNumbersView = "loading" | "failed" | { connected: boolean };

export interface LeadSendNumbers {
  official: SendNumbersView;
  unofficial: SendNumbersView;
}

export interface LeadSendStates {
  send_template: ActionState<LeadSendBlocker>;
  send_message: ActionState<LeadSendBlocker>;
}

function numbersState(numbers: SendNumbersView, none: LeadSendBlocker): ActionState<LeadSendBlocker> {
  if (numbers === "loading") return { enabled: false, reason: "checkingNumbers" };
  if (numbers === "failed") return { enabled: false, reason: "numbersUnavailable" };
  return numbers.connected ? READY : { enabled: false, reason: none };
}

function channelState(decision: CapabilityDecision, missing: LeadSendBlocker, numbers: SendNumbersView, none: LeadSendBlocker): ActionState<LeadSendBlocker> {
  const state = firstBlocker<LeadSendBlocker>([
    [decision === "loading", "checkingAccess"],
    [decision !== "granted", missing],
  ]);
  return state.enabled ? numbersState(numbers, none) : state;
}

export function leadSendStates({
  template,
  unofficial,
  numbers,
}: {
  template: CapabilityDecision;
  unofficial: CapabilityDecision;
  numbers: LeadSendNumbers;
}): LeadSendStates {
  return {
    send_template: channelState(template, "permissionSendTemplate", numbers.official, "noOfficialNumber"),
    send_message: channelState(unofficial, "permissionSendUnofficial", numbers.unofficial, "noUnofficialNumber"),
  };
}
