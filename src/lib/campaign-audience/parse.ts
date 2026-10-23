import { isCount, isJson, isText, type Json } from "@/lib/json/guards";

import {
  AUDIENCE_BLOCKERS,
  AUDIENCE_LEAD_STATUSES,
  AUDIENCE_CHANNELS,
  VARIABLE_FILLS,
  type AudienceBlocker,
  type AudienceChannel,
  type AudienceCount,
  type AudienceLead,
  type AudienceLeadPage,
  type AudienceLeadStatus,
  type AudienceSource,
  type BindableField,
  type ListCount,
  type ListPreview,
  type ListRow,
  type MetadataColumn,
  type MetadataGap,
  type MissingPolicy,
  type RowPage,
  type SavedRow,
  type SelectionCount,
  type SkippedLine,
  type TemplateSuggestion,
  type TemplateSuggestions,
  type VariableColumn,
  type VariableCount,
  type VariableFill,
} from "./types";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isSlot(value: unknown): value is number {
  return isCount(value) && value > 0;
}

function oneOf<T extends string>(values: readonly T[]) {
  return (value: unknown): value is T => typeof value === "string" && (values as readonly string[]).includes(value);
}

const isChannel = oneOf<AudienceChannel>(AUDIENCE_CHANNELS);
const isSource = oneOf<AudienceSource>(["leads", "list"]);
const isBlocker = oneOf<AudienceBlocker>(AUDIENCE_BLOCKERS);
const isFill = oneOf<VariableFill>(VARIABLE_FILLS);
const isPolicy = oneOf<MissingPolicy | "">(["text", "exclude", ""]);
const isLeadStatus = oneOf<AudienceLeadStatus>(AUDIENCE_LEAD_STATUSES);
const isFieldKind = oneOf<BindableField["kind"]>(["lead", "custom"]);
const isContactKind = oneOf<ListPreview["contact"]>(["phone", "email"]);

function list<T>(value: unknown, item: (value: unknown) => T | null): T[] | null {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const items = value.map(item);
  return items.some((parsed) => parsed === null) ? null : (items as T[]);
}

function counts(value: unknown): Record<string, number> | null {
  if (value === null || value === undefined) return {};
  if (!isJson(value)) return null;
  const out: Record<string, number> = {};
  for (const [reason, count] of Object.entries(value)) {
    if (!isCount(count)) return null;
    out[reason] = count;
  }
  return out;
}

function optionalText(value: Json, key: string): Record<string, string> | null {
  const text = value[key];
  if (text === undefined || text === null || text === "") return {};
  return isString(text) ? { [key]: text } : null;
}

function withOptionalTexts<T extends object>(base: T, value: Json, keys: readonly string[]): T | null {
  const extras = keys.map((key) => optionalText(value, key));
  if (extras.some((extra) => extra === null)) return null;
  return Object.assign({}, base, ...extras) as T;
}

function parseMetadataGap(value: unknown): MetadataGap | null {
  if (!isJson(value) || !isText(value.key) || !isCount(value.missing)) return null;
  const lines = list(value.lines, (item) => (isCount(item) ? item : null));
  return lines ? { key: value.key, missing: value.missing, lines } : null;
}

function parseVariableCount(value: unknown): VariableCount | null {
  if (!isJson(value) || !isText(value.key) || !isCount(value.missing) || !isPolicy(value.policy)) return null;
  if (typeof value.suggested !== "boolean" || typeof value.choiceRequired !== "boolean") return null;
  if (value.header !== undefined && typeof value.header !== "boolean") return null;
  if (value.name !== undefined && value.name !== "" && !isText(value.name)) return null;
  const name = isText(value.name) ? value.name : value.key;
  return withOptionalTexts<VariableCount>(
    { key: value.key, name, header: value.header === true, missing: value.missing, policy: value.policy, suggested: value.suggested, choiceRequired: value.choiceRequired },
    value,
    ["source", "value", "text", "fallback"],
  );
}

function parseSelectionCount(value: unknown): SelectionCount | null | undefined {
  if (value === null || value === undefined) return undefined;
  if (!isJson(value) || !isCount(value.selected) || !isCount(value.confirmCount)) return null;
  return withOptionalTexts<SelectionCount>({ selected: value.selected, confirmCount: value.confirmCount }, value, ["fingerprint"]);
}

function parseListCount(value: unknown): ListCount | null | undefined {
  if (value === null || value === undefined) return undefined;
  if (!isJson(value) || !isText(value.id) || !isCount(value.rows) || !isCount(value.existing) || !isCount(value.new)) return null;
  return { id: value.id, rows: value.rows, existing: value.existing, new: value.new };
}

export function parseAudienceCount(value: unknown): AudienceCount | null {
  if (!isJson(value) || !isChannel(value.channel) || !isSource(value.source)) return null;
  if (!isCount(value.matched) || !isCount(value.withContact) || !isCount(value.outTotal) || !isCount(value.requiredVariables)) return null;
  if (value.sendable !== null && !isCount(value.sendable)) return null;
  const out = counts(value.out);
  const variables = list(value.variables, parseVariableCount);
  const blockers = list(value.blockers, (item) => (isBlocker(item) ? item : null));
  const selection = parseSelectionCount(value.selection);
  const listCount = parseListCount(value.list);
  const metadataMissing = list(value.metadataMissing, parseMetadataGap);
  if (!out || !variables || !blockers || selection === null || listCount === null || !metadataMissing) return null;
  return {
    channel: value.channel,
    source: value.source,
    matched: value.matched,
    withContact: value.withContact,
    sendable: value.sendable,
    out,
    outTotal: value.outTotal,
    requiredVariables: value.requiredVariables,
    variables,
    blockers,
    selection: selection ?? null,
    list: listCount ?? null,
    metadataMissing,
  };
}

function parseVariableColumn(value: unknown): VariableColumn | null {
  if (!isJson(value) || !isSlot(value.slot) || !isFill(value.fill)) return null;
  return withOptionalTexts<VariableColumn>({ slot: value.slot, fill: value.fill }, value, ["column", "field"]);
}

function parseMetadataColumn(value: unknown): MetadataColumn | null {
  if (!isJson(value) || !isText(value.key) || !isString(value.label)) return null;
  return { key: value.key, label: value.label };
}

function parseSkippedLine(value: unknown): SkippedLine | null {
  if (!isJson(value) || !isCount(value.line) || !isText(value.reason) || !isString(value.raw)) return null;
  const line: SkippedLine = { line: value.line, reason: value.reason, raw: value.raw };
  if (value.duplicateOf === undefined || value.duplicateOf === null) return line;
  return isSlot(value.duplicateOf) ? { ...line, duplicateOf: value.duplicateOf } : null;
}

export function parseListPreview(value: unknown): ListPreview | null {
  if (!isJson(value) || !isText(value.id) || !isChannel(value.channel) || !isContactKind(value.contact)) return null;
  if (!isString(value.fileName) || !isCount(value.lines) || !isCount(value.rows) || !isCount(value.existing) || !isCount(value.new)) return null;
  if (typeof value.header !== "boolean" || !isCount(value.variableColumns) || !isJson(value.columns) || !isJson(value.skipped)) return null;
  const variables = list(value.columns.variables, parseVariableColumn);
  const metadata = list(value.columns.metadata, parseMetadataColumn);
  const byReason = counts(value.skipped.byReason);
  const lines = list(value.skipped.lines, parseSkippedLine);
  const metadataMissing = list(value.metadataMissing, parseMetadataGap);
  const columns = withOptionalTexts({ variables: variables ?? [], metadata: metadata ?? [] }, value.columns, ["contact", "name"]);
  if (!variables || !metadata || !byReason || !lines || !metadataMissing || !columns || !isCount(value.skipped.total)) return null;
  if (value.expiresAt !== null && value.expiresAt !== undefined && !isString(value.expiresAt)) return null;
  return {
    id: value.id,
    channel: value.channel,
    contact: value.contact,
    fileName: value.fileName,
    lines: value.lines,
    rows: value.rows,
    existing: value.existing,
    new: value.new,
    header: value.header,
    columns,
    variableColumns: value.variableColumns,
    skipped: { total: value.skipped.total, byReason, lines },
    metadataMissing,
    expiresAt: isString(value.expiresAt) ? value.expiresAt : null,
  };
}

function stringList(value: unknown): string[] | null {
  return list(value, (item) => (isString(item) ? item : null));
}

function metadataOf(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return {};
  return isJson(value) ? value : null;
}

export function parseSavedRow(value: unknown): SavedRow | null {
  if (!isJson(value) || !isText(value.id) || !isCount(value.line) || !isString(value.contact) || !isString(value.name)) return null;
  const variables = stringList(value.variables);
  const metadata = metadataOf(value.metadata);
  if (!variables || !metadata) return null;
  return { id: value.id, line: value.line, contact: value.contact, name: value.name, variables, metadata };
}

function parseListRow(value: unknown): ListRow | null {
  const row = parseSavedRow(value);
  if (!row || !isJson(value) || typeof value.existing !== "boolean") return null;
  const missing = list(value.missing, (item) => (isSlot(item) ? item : null));
  const metadataMissing = list(value.metadataMissing, (item) => (isText(item) ? item : null));
  return missing && metadataMissing ? { ...row, missing, metadataMissing, existing: value.existing } : null;
}

export function parseRowPage(value: unknown): RowPage | null {
  if (!isJson(value) || !isJson(value.meta)) return null;
  const items = list(value.data, parseListRow);
  const { page, pageSize, totalPages, totalItems } = value.meta;
  if (!items || !isCount(page) || !isCount(pageSize) || !isCount(totalPages) || !isCount(totalItems)) return null;
  return { items, page, pageSize, totalPages, totalItems };
}

function parseAudienceLead(value: unknown): AudienceLead | null {
  if (!isJson(value) || !isString(value.leadId) || !isCount(value.line) || !isString(value.name) || !isString(value.contact)) return null;
  if (!isLeadStatus(value.status) || !isString(value.reason)) return null;
  const missing = stringList(value.missing);
  const metadataMissing = stringList(value.metadataMissing);
  const variables = stringList(value.variables);
  if (!missing || !metadataMissing || !variables) return null;
  return { leadId: value.leadId, line: value.line, name: value.name, contact: value.contact, status: value.status, reason: value.reason, missing, metadataMissing, variables };
}

export function parseAudienceLeadPage(value: unknown): AudienceLeadPage | null {
  if (!isJson(value) || !isJson(value.meta)) return null;
  const items = list(value.data, parseAudienceLead);
  const { page, pageSize, totalPages, totalItems } = value.meta;
  if (!items || !isCount(page) || !isCount(pageSize) || !isCount(totalPages) || !isCount(totalItems)) return null;
  return { items, page, pageSize, totalPages, totalItems };
}

function parseBindableField(value: unknown): BindableField | null {
  if (!isJson(value) || !isText(value.source) || !isFieldKind(value.kind) || !isString(value.column)) return null;
  return withOptionalTexts<BindableField>({ source: value.source, kind: value.kind, column: value.column }, value, ["key", "label", "type"]);
}

export function parseBindableFields(value: unknown): BindableField[] | null {
  return Array.isArray(value) ? list(value, parseBindableField) : null;
}

function parseSuggestion(value: unknown): TemplateSuggestion | null {
  if (!isJson(value) || !isSlot(value.slot) || !isText(value.source)) return null;
  return { slot: value.slot, source: value.source };
}

export function parseTemplateSuggestions(value: unknown): TemplateSuggestions | null {
  if (!isJson(value) || !isText(value.templateId)) return null;
  const suggestions = list(value.suggestions, parseSuggestion);
  return suggestions ? { templateId: value.templateId, suggestions } : null;
}
