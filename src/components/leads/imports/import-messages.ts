import type { CodedRefusal } from "@/lib/api/coded-error";
import { messageKeyOf, type LeadImportField, type LeadImportLimits } from "@/lib/leads/imports";

export interface ImportTranslator {
  (key: string, values?: Record<string, string | number>): string;
  has: (key: string) => boolean;
}

const CUSTOM_FIELD_PREFIX = "custom_field:";

const MAPPING_INVALID = "lead_import_mapping_invalid";
const FORBIDDEN = "lead_import_forbidden";
const FILE_TOO_LARGE = "lead_import_file_too_large";
const TOO_MANY_ROWS = "lead_import_too_many_rows";

const BYTES_PER_MEGABYTE = 1024 * 1024;

function positiveNumber(value: string | undefined): number | null {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function importLimitMegabytes(expected: Record<string, string> | undefined, limits: LeadImportLimits | null): number | null {
  const bytes = positiveNumber(expected?.maxBytes);
  if (bytes !== null) return Math.round((bytes / BYTES_PER_MEGABYTE) * 10) / 10;
  return limits?.maxMegabytes ?? null;
}

function importLimitRows(expected: Record<string, string> | undefined, limits: LeadImportLimits | null): number | null {
  return positiveNumber(expected?.maxRows) ?? limits?.maxRows ?? null;
}

function known(t: ImportTranslator, key: string, fallback: string, values?: Record<string, string | number>): string {
  return t.has(key) ? t(key, values) : t(fallback, values);
}

export function importFieldLabel(t: ImportTranslator, key: string, fields: readonly LeadImportField[]): string {
  if (key.startsWith(CUSTOM_FIELD_PREFIX)) {
    const label = fields.find((field) => field.key === key)?.label || key.slice(CUSTOM_FIELD_PREFIX.length);
    return t("fields.custom", { label });
  }
  const messageKey = `fields.${messageKeyOf(key)}`;
  return t.has(messageKey) ? t(messageKey) : t("fields.unknown", { key });
}

export function importRequiresLabel(t: ImportTranslator, permission: string | undefined): string {
  return known(t, `requires.${messageKeyOf(permission ?? "")}`, "requires.other");
}

export function importGroupLabel(t: ImportTranslator, group: string): string {
  return known(t, `groups.${messageKeyOf(group)}`, "groups.other");
}

export function importReasonLabel(t: ImportTranslator, code: string): string {
  return known(t, `reasons.${code}`, "reasons.other");
}

export function importFailureLabel(t: ImportTranslator, code: string | undefined): string {
  return known(t, `failure.${code ?? ""}`, "failure.unknown");
}

export function importColumnName(t: ImportTranslator, headers: readonly string[], index: number): string {
  return headers[index]?.trim() || t("mapping.column", { index: index + 1 });
}

export interface ImportErrorContext {
  headers: readonly string[];
  fields: readonly LeadImportField[];
  formatNumber: (value: number) => string;
  limits: LeadImportLimits | null;
}

export function importErrorMessage(t: ImportTranslator, error: CodedRefusal, context: ImportErrorContext): string {
  const expected = error.expected ?? {};
  switch (error.code) {
    case FORBIDDEN:
      return t(`errors.${FORBIDDEN}`, {
        permission: known(t, `permissions.${messageKeyOf(expected.permission ?? "")}`, "permissions.other"),
      });
    case MAPPING_INVALID: {
      const rule = `mappingRules.${expected.rule ?? ""}`;
      if (!expected.rule || !t.has(rule)) return t(`errors.${MAPPING_INVALID}`);
      const column = Number.parseInt(expected.column ?? "", 10);
      return t(rule, {
        column: Number.isInteger(column) && column >= 0 ? importColumnName(t, context.headers, column) : "",
        field: expected.field ? importFieldLabel(t, expected.field, context.fields) : "",
      });
    }
    case FILE_TOO_LARGE: {
      const megabytes = importLimitMegabytes(error.expected, context.limits);
      if (megabytes === null) return t(`errors.${FILE_TOO_LARGE}_unknown`);
      return t(`errors.${FILE_TOO_LARGE}`, { megabytes: context.formatNumber(megabytes) });
    }
    case TOO_MANY_ROWS: {
      const rows = importLimitRows(error.expected, context.limits);
      if (rows === null) return t(`errors.${TOO_MANY_ROWS}_unknown`);
      return t(`errors.${TOO_MANY_ROWS}`, { rows: context.formatNumber(rows) });
    }
    default:
      return error.code ? known(t, `errors.${error.code}`, "generic") : t("generic");
  }
}

export function importErrorColumn(error: CodedRefusal | null | undefined): number | null {
  if (!error || error.code !== MAPPING_INVALID) return null;
  const column = Number.parseInt(error.expected?.column ?? "", 10);
  return Number.isInteger(column) && column >= 0 ? column : null;
}

export function isMappingRefusal(error: CodedRefusal | null | undefined): boolean {
  return error?.code === MAPPING_INVALID;
}
