import { assignColumn } from "@/lib/csv/column-mapping";

export const LEAD_IMPORT_STATUSES = ["uploaded", "analyzing", "analyzed", "importing", "done", "failed"] as const;

export type LeadImportStatus = (typeof LEAD_IMPORT_STATUSES)[number];

export type LeadImportStage = "rows" | "links" | "seed";

export const LEAD_IMPORT_GROUPS = ["identity", "phones", "contact", "address", "owner", "consent", "custom", "family"] as const;

export type LeadImportFieldGroup = (typeof LEAD_IMPORT_GROUPS)[number];

export type LeadImportPolicy = "fill_empty" | "skip";

export type LeadImportStep = "file" | "columns" | "importing" | "done";

export const LEAD_IMPORT_ACCEPT = ".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain";

export interface LeadImportColumn {
  index: number;
  header: string;
  field: string;
}

export interface LeadImportPreview {
  headers: string[];
  sample: string[][];
  columns: LeadImportColumn[];
}

export interface LeadImportField {
  key: string;
  group: LeadImportFieldGroup | string;
  label?: string;
  requires?: string;
  allowed: boolean;
  sensitive: boolean;
  repeatable: boolean;
}

export interface LeadImportOptions {
  fillEmpty: boolean;
  seedInbox: boolean;
  seedConversations: boolean;
}

export interface LeadImportSettings {
  columns: LeadImportColumn[];
  onExisting: LeadImportPolicy | string;
  seedInbox: boolean;
  seedConversations: boolean;
  seedScript?: LeadImportSeedScript;
}

export interface LeadImportCounts {
  rows: number;
  created: number;
  enriched: number;
  unchanged: number;
  skipped: number;
  rejected: number;
  conflicting: number;
  blocked: number;
  addressesAdded: number;
  addressesLocated: number;
  addressesFilled: number;
  linksPlanned: number;
  linksCreated: number;
  noAddress?: number;
  issues: Record<string, number>;
}

export interface LeadImportSeed {
  queued: number;
  scriptedQueued?: number;
  error?: string;
  scriptError?: string;
  unconfirmed?: number;
}

export const LEAD_IMPORT_PLACEMENT_KEYS = ["onMap", "approximate", "pending", "notFound", "quotaExceeded", "refused"] as const;

export type LeadImportPlacement = Record<(typeof LEAD_IMPORT_PLACEMENT_KEYS)[number], number>;

export type LeadImportPlacementBucket = "precise" | "approximate" | "pending" | "notLocated" | "noAddress";

export interface LeadImportPlacementRow {
  key: LeadImportPlacementBucket;
  value: number | null;
  percent: number | null;
}

export interface LeadImportLimits {
  maxBytes: number;
  maxMegabytes: number;
  maxRows: number;
  maxSeededConversations: number;
  retentionDays: number;
  maxUnusedUploads: number;
}

export interface LeadImportSummary {
  id: string;
  status: LeadImportStatus;
  stage?: LeadImportStage | string;
  fileName: string;
  sizeBytes: number;
  totalRows: number;
  processed: number;
  dryRun?: LeadImportCounts;
  result?: LeadImportCounts;
  seed?: LeadImportSeed;
  failureCode?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  expiresAt: string;
}

const LEAD_IMPORT_SUMMARY_KEYS = [
  "id",
  "status",
  "stage",
  "fileName",
  "sizeBytes",
  "totalRows",
  "processed",
  "dryRun",
  "result",
  "seed",
  "failureCode",
  "createdAt",
  "startedAt",
  "finishedAt",
  "expiresAt",
] as const satisfies readonly (keyof LeadImportSummary)[];

export function leadImportSummaryOf(job: LeadImportSummary): LeadImportSummary {
  const entries = LEAD_IMPORT_SUMMARY_KEYS.filter((key) => job[key] !== undefined).map((key) => [key, job[key]]);
  return Object.fromEntries(entries) as unknown as LeadImportSummary;
}

export interface LeadImportJob extends LeadImportSummary {
  preview: LeadImportPreview;
  fields: LeadImportField[];
  options: LeadImportOptions;
  settings?: LeadImportSettings;
  placement?: LeadImportPlacement;
}

export interface LeadImportList {
  items: LeadImportSummary[];
  limits: LeadImportLimits | null;
}

export interface LeadImportSeedAttachment {
  mediaId: string;
  kind: string;
}

export interface LeadImportSeedScript {
  bodies: string[];
  maxMessages: number;
  context?: string;
  attachment?: LeadImportSeedAttachment;
}

export interface LeadImportDryRunBody {
  columns: { index: number; field: string }[];
  onExisting: LeadImportPolicy;
  seedInbox: boolean;
  seedConversations?: LeadImportSeedScript;
}

export function isLeadImportActive(status: LeadImportStatus): boolean {
  return status === "analyzing" || status === "importing";
}

export function leadImportStep(job: LeadImportSummary): LeadImportStep {
  switch (job.status) {
    case "importing":
      return "importing";
    case "done":
      return "done";
    case "failed":
      return job.startedAt ? "importing" : "columns";
    default:
      return "columns";
  }
}

export function leadImportPercent(job: Pick<LeadImportJob, "processed" | "totalRows">): number {
  if (job.totalRows <= 0) return 0;
  return Math.max(0, Math.min(100, Math.floor((job.processed * 100) / job.totalRows)));
}

export function initialImportMapping(job: LeadImportJob): string[] {
  const mapping = job.preview.headers.map(() => "");
  const locked = new Set(job.fields.filter((field) => !field.allowed).map((field) => field.key));
  const chosen = job.settings?.columns;
  for (const column of chosen ?? job.preview.columns) {
    if (column.index < 0 || column.index >= mapping.length) continue;
    const field = column.field ?? "";
    mapping[column.index] = !chosen && locked.has(field) ? "" : field;
  }
  return mapping;
}

export function assignImportField(
  mapping: readonly string[],
  index: number,
  field: string,
  fields: readonly LeadImportField[],
): string[] {
  const repeatable = new Set(fields.filter((f) => f.repeatable).map((f) => f.key));
  return assignColumn(mapping, index, field, (key) => repeatable.has(key));
}

export function importColumnsBody(mapping: readonly string[]): { index: number; field: string }[] {
  return mapping.flatMap((field, index) => (field ? [{ index, field }] : []));
}

export function recognisedColumnCount(mapping: readonly string[]): number {
  return mapping.filter(Boolean).length;
}

export function groupImportFields(fields: readonly LeadImportField[]): { group: string; fields: LeadImportField[] }[] {
  const known: readonly string[] = LEAD_IMPORT_GROUPS;
  const others = [...new Set(fields.map((f) => f.group).filter((group) => !known.includes(group)))];
  return [...known, ...others]
    .map((group) => ({ group, fields: fields.filter((f) => f.group === group) }))
    .filter((entry) => entry.fields.length > 0);
}

export function defaultImportPolicy(job: LeadImportJob): LeadImportPolicy {
  const chosen = job.settings?.onExisting;
  if (chosen === "fill_empty" || chosen === "skip") return chosen;
  return job.options.fillEmpty ? "fill_empty" : "skip";
}

export function messageKeyOf(key: string): string {
  return key.replace(/[^a-z0-9_]/gi, "_");
}

export function importIssueEntries(counts: LeadImportCounts | undefined): [string, number][] {
  return Object.entries(counts?.issues ?? {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function importIssueTotal(counts: LeadImportCounts | undefined): number {
  return importIssueEntries(counts).reduce((total, [, count]) => total + count, 0);
}

function shareOf(value: number, total: number): number {
  return total > 0 ? Math.round((value * 100) / total) : 0;
}

export function importPlacementRows(
  placement: LeadImportPlacement | undefined,
  noAddress: number | undefined,
): LeadImportPlacementRow[] {
  const values: { key: LeadImportPlacementBucket; value: number | null }[] = [
    { key: "precise", value: placement ? placement.onMap : null },
    { key: "approximate", value: placement ? placement.approximate : null },
    { key: "pending", value: placement ? placement.pending + placement.quotaExceeded : null },
  ];
  const notLocated = placement ? placement.notFound + placement.refused : 0;
  if (notLocated > 0) values.push({ key: "notLocated", value: notLocated });
  values.push({ key: "noAddress", value: noAddress ?? null });
  const total = values.reduce((sum, row) => sum + (row.value ?? 0), 0);
  return values.map((row) => ({ ...row, percent: row.value === null ? null : shareOf(row.value, total) }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is LeadImportStatus {
  return typeof value === "string" && (LEAD_IMPORT_STATUSES as readonly string[]).includes(value);
}

function arrayOr<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositive(value: unknown): value is number {
  return isCount(value) && value > 0;
}

function readPlacement(value: unknown): LeadImportPlacement | undefined {
  if (!isRecord(value)) return undefined;
  const placement = {} as LeadImportPlacement;
  for (const key of LEAD_IMPORT_PLACEMENT_KEYS) {
    const count = value[key];
    if (!isCount(count)) return undefined;
    placement[key] = count;
  }
  return placement;
}

function readSeedScript(value: unknown): LeadImportSeedScript | undefined {
  if (!isRecord(value) || !isPositive(value.maxMessages)) return undefined;
  const bodies = arrayOr<unknown>(value.bodies).filter((body): body is string => typeof body === "string" && body.trim() !== "");
  if (bodies.length === 0) return undefined;
  const attachment = isRecord(value.attachment) ? value.attachment : null;
  return {
    bodies,
    maxMessages: value.maxMessages,
    ...(typeof value.context === "string" && value.context ? { context: value.context } : {}),
    ...(attachment && typeof attachment.mediaId === "string" && attachment.mediaId && typeof attachment.kind === "string"
      ? { attachment: { mediaId: attachment.mediaId, kind: attachment.kind } }
      : {}),
  };
}

function readSettings(value: unknown): LeadImportSettings | undefined {
  if (!isRecord(value)) return undefined;
  const { seedScript: rawScript, ...rest } = value;
  const seedScript = readSeedScript(rawScript);
  return {
    ...(rest as unknown as LeadImportSettings),
    columns: arrayOr<LeadImportColumn>(value.columns),
    ...(seedScript ? { seedScript } : {}),
  };
}

function readLimits(value: unknown): LeadImportLimits | null {
  if (!isRecord(value)) return null;
  const { maxBytes, maxMegabytes, maxRows, maxSeededConversations, retentionDays, maxUnusedUploads } = value;
  if (
    !isPositive(maxBytes) ||
    !isPositive(maxMegabytes) ||
    !isPositive(maxRows) ||
    !isPositive(maxSeededConversations) ||
    !isPositive(retentionDays) ||
    !isPositive(maxUnusedUploads)
  ) {
    return null;
  }
  return { maxBytes, maxMegabytes, maxRows, maxSeededConversations, retentionDays, maxUnusedUploads };
}

export function readLeadImportSummary(value: unknown): LeadImportSummary | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id || !isStatus(value.status)) return null;
  return value as unknown as LeadImportSummary;
}

export function readLeadImportList(value: unknown): LeadImportList | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const items = value.items.flatMap((item: unknown) => {
    const summary = readLeadImportSummary(item);
    return summary ? [summary] : [];
  });
  return { items, limits: readLimits(value.limits) };
}

export function readLeadImportJob(value: unknown): LeadImportJob | null {
  if (!isRecord(value) || !readLeadImportSummary(value)) return null;
  const preview = isRecord(value.preview) ? value.preview : null;
  if (!preview) return null;
  const options = isRecord(value.options) ? value.options : {};
  const { placement: rawPlacement, settings: rawSettings, ...rest } = value;
  const placement = readPlacement(rawPlacement);
  const settings = readSettings(rawSettings);
  return {
    ...(rest as unknown as LeadImportJob),
    ...(placement ? { placement } : {}),
    ...(settings ? { settings } : {}),
    fields: arrayOr<LeadImportField>(value.fields),
    preview: {
      headers: arrayOr<string>(preview.headers),
      sample: arrayOr<string[]>(preview.sample),
      columns: arrayOr<LeadImportColumn>(preview.columns),
    },
    options: {
      fillEmpty: options.fillEmpty === true,
      seedInbox: options.seedInbox === true,
      seedConversations: options.seedConversations === true,
    },
  };
}
