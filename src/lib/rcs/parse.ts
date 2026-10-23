import { parseCarrierPrice, parseChannelAutomation, parseNullableId } from "@/lib/carrier-messaging/parse";
import { isCount, isJson, isText, type Json } from "@/lib/json/guards";
import {
  RCS_BILLING_CATEGORIES,
  RCS_BILLING_CLASSES,
  RCS_CHARGE_KINDS,
  RCS_CONTENT_KINDS,
  RCS_MEDIA_KINDS,
  RCS_PAUSE_REASONS,
  RCS_PAUSED_BY,
  RCS_SECTORS,
  RCS_SENDER_STATUSES,
  RCS_SUGGESTION_KINDS,
  RCS_USE_CASES,
  type RcsCalendarEvent,
  type RcsCard,
  type RcsContent,
  type RcsContentCheck,
  type RcsContentIssue,
  type RcsMedia,
  type RcsSender,
  type RcsSenderList,
  type RcsSuggestion,
} from "@/lib/rcs/types";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function blankOr<T extends string>(list: readonly T[], value: unknown): value is T | "" {
  return value === "" || oneOf(list, value);
}

function timestamp(value: unknown): value is string | null {
  return value === null || isText(value);
}

const SENDER_TEXT_FIELDS = [
  "brand_name",
  "description",
  "suggested_description",
  "logo_url",
  "banner_url",
  "color",
  "gambling_authorization_url",
  "contact_name",
  "contact_email",
  "contact_phone",
  "website_url",
  "privacy_url",
  "terms_url",
  "cnpj",
  "status_reason",
] as const;

function senderEnumsValid(value: Json): boolean {
  return (
    oneOf(RCS_SENDER_STATUSES, value.status) &&
    blankOr(RCS_USE_CASES, value.use_case) &&
    blankOr(RCS_SECTORS, value.sector) &&
    blankOr(RCS_BILLING_CATEGORIES, value.billing_category) &&
    blankOr(RCS_PAUSED_BY, value.paused_by) &&
    blankOr(RCS_PAUSE_REASONS, value.pause_reason)
  );
}

export function parseRcsSender(value: unknown): RcsSender | null {
  if (!isJson(value) || !isText(value.id) || !isText(value.created_at)) return null;
  if (!SENDER_TEXT_FIELDS.every((field) => isString(value[field]))) return null;
  if (!senderEnumsValid(value)) return null;
  if (!timestamp(value.submitted_at) || !timestamp(value.launched_at) || !timestamp(value.paused_at)) return null;
  if (typeof value.can_send !== "boolean" || typeof value.editable !== "boolean" || typeof value.can_resume !== "boolean") return null;
  const automation = parseChannelAutomation(value.automation);
  const departmentId = parseNullableId(value.department_id);
  const pipelineId = parseNullableId(value.pipeline_id);
  if (!automation || departmentId === undefined || pipelineId === undefined) return null;
  const sender: RcsSender = {
    id: value.id,
    brand_name: value.brand_name as string,
    description: value.description as string,
    suggested_description: value.suggested_description as string,
    logo_url: value.logo_url as string,
    banner_url: value.banner_url as string,
    color: value.color as string,
    use_case: value.use_case as RcsSender["use_case"],
    sector: value.sector as RcsSender["sector"],
    gambling_authorization_url: value.gambling_authorization_url as string,
    contact_name: value.contact_name as string,
    contact_email: value.contact_email as string,
    contact_phone: value.contact_phone as string,
    website_url: value.website_url as string,
    privacy_url: value.privacy_url as string,
    terms_url: value.terms_url as string,
    cnpj: value.cnpj as string,
    billing_category: value.billing_category as RcsSender["billing_category"],
    status: value.status as RcsSender["status"],
    status_reason: value.status_reason as string,
    paused_by: value.paused_by as RcsSender["paused_by"],
    pause_reason: value.pause_reason as RcsSender["pause_reason"],
    submitted_at: value.submitted_at,
    launched_at: value.launched_at,
    paused_at: value.paused_at,
    created_at: value.created_at,
    can_send: value.can_send,
    editable: value.editable,
    can_resume: value.can_resume,
    department_id: departmentId,
    pipeline_id: pipelineId,
    automation,
  };
  if (isText(value.workspace_id)) sender.workspace_id = value.workspace_id;
  return sender;
}

export function parseRcsSenderList(value: unknown): RcsSenderList | null {
  if (!isJson(value) || !Array.isArray(value.senders)) return null;
  const senders = value.senders.map(parseRcsSender);
  if (senders.some((sender) => sender === null)) return null;
  return { senders: senders as RcsSender[] };
}

function parseIssue(value: unknown): RcsContentIssue | null {
  if (!isJson(value) || !isText(value.code) || !isString(value.path)) return null;
  return { code: value.code, path: value.path };
}

function parseIssues(value: unknown): RcsContentIssue[] | null {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const issues = value.map(parseIssue);
  return issues.some((issue) => issue === null) ? null : (issues as RcsContentIssue[]);
}


export function parseRcsContentCheck(value: unknown): RcsContentCheck | null {
  if (!isJson(value) || !oneOf(RCS_CONTENT_KINDS, value.kind) || !oneOf(RCS_BILLING_CLASSES, value.billing_class)) return null;
  if (!isCount(value.variable_slots)) return null;
  const issues = parseIssues(value.issues);
  const price = parseCarrierPrice(value.price, RCS_CHARGE_KINDS);
  if (!issues || !price) return null;
  return { kind: value.kind, billing_class: value.billing_class, variable_slots: value.variable_slots, issues, price };
}

export function parseRcsMedia(value: unknown): RcsMedia | null {
  if (!isJson(value) || !oneOf(RCS_MEDIA_KINDS, value.kind) || !isText(value.url) || !isText(value.mime_type)) return null;
  const media: RcsMedia = { kind: value.kind, url: value.url, mime_type: value.mime_type };
  if (isText(value.name)) media.name = value.name;
  if (isCount(value.size_bytes)) media.size_bytes = value.size_bytes;
  return media;
}

function optionalText(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function parseCalendar(value: unknown): RcsCalendarEvent | null {
  if (!isJson(value) || typeof value.title !== "string" || typeof value.starts_at !== "string" || typeof value.ends_at !== "string") return null;
  if (!optionalText(value.description)) return null;
  const event: RcsCalendarEvent = { title: value.title, starts_at: value.starts_at, ends_at: value.ends_at };
  if (value.description) event.description = value.description;
  return event;
}

function parseSuggestion(value: unknown): RcsSuggestion | null {
  if (!isJson(value) || !oneOf(RCS_SUGGESTION_KINDS, value.kind) || typeof value.label !== "string") return null;
  const texts = ["postback", "url", "phone", "location_label"] as const;
  if (!texts.every((key) => optionalText(value[key]))) return null;
  if (value.webview !== undefined && typeof value.webview !== "boolean") return null;
  const suggestion: RcsSuggestion = { kind: value.kind, label: value.label };
  for (const key of texts) if (value[key]) suggestion[key] = value[key] as string;
  if (value.webview) suggestion.webview = true;
  if (typeof value.latitude === "number") suggestion.latitude = value.latitude;
  if (typeof value.longitude === "number") suggestion.longitude = value.longitude;
  if (value.calendar !== undefined && value.calendar !== null) {
    const calendar = parseCalendar(value.calendar);
    if (!calendar) return null;
    suggestion.calendar = calendar;
  }
  return suggestion;
}

function parseSuggestions(value: unknown): RcsSuggestion[] | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return null;
  const list = value.map(parseSuggestion);
  return list.some((item) => item === null) ? null : (list as RcsSuggestion[]);
}

function parseCard(value: unknown): RcsCard | null {
  if (!isJson(value) || !optionalText(value.title) || !optionalText(value.description)) return null;
  const card: RcsCard = {};
  if (value.media !== undefined && value.media !== null) {
    const media = parseRcsMedia(value.media);
    if (!media) return null;
    card.media = media;
  }
  if (value.title) card.title = value.title;
  if (value.description) card.description = value.description;
  const suggestions = parseSuggestions(value.suggestions);
  if (suggestions === null) return null;
  if (suggestions) card.suggestions = suggestions;
  return card;
}

export function parseRcsContent(value: unknown): RcsContent | null {
  if (!isJson(value) || !optionalText(value.text)) return null;
  const content: RcsContent = {};
  if (value.text) content.text = value.text;
  if (value.media !== undefined && value.media !== null) {
    const media = parseRcsMedia(value.media);
    if (!media) return null;
    content.media = media;
  }
  if (value.cards !== undefined && value.cards !== null) {
    if (!Array.isArray(value.cards)) return null;
    const cards = value.cards.map(parseCard);
    if (cards.some((card) => card === null)) return null;
    if (cards.length > 0) content.cards = cards as RcsCard[];
  }
  const suggestions = parseSuggestions(value.suggestions);
  if (suggestions === null) return null;
  if (suggestions) content.suggestions = suggestions;
  return content;
}
