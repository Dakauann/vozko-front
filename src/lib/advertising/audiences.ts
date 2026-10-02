import type { CrmFilter } from "@/lib/crm/board";
import type { AdDraftTargeting, AdPlacements } from "@/lib/advertising/draft-types";

export type AudienceKind = "CUSTOMER_LIST" | "LOOKALIKE" | "WEBSITE" | "ENGAGEMENT" | "OTHER";

export interface Audience {
  metaId: string;
  name: string;
  description?: string;
  kind: AudienceKind | string;
  approxLower: number;
  approxUpper: number;
  deliveryCode: number;
  deliveryDescription?: string;
  operationCode: number;
  operationDescription?: string;
  originAudienceId?: string;
  lookalikeCountry?: string;
  lookalikeRatio?: number;
  retentionDays?: number;
  createdTime?: string;
  updatedTime?: string;
}

export interface AudienceList {
  termsAccepted: boolean;
  termsUrl?: string;
  audiences: Audience[] | null;
}

export type MatchKey = "EMAIL" | "PHONE" | "FN" | "LN" | "CT" | "ST" | "ZIP" | "COUNTRY" | "EXTERN_ID" | "GEN" | "DOBY";

export const MATCH_KEYS: MatchKey[] = ["EMAIL", "PHONE", "FN", "LN", "CT", "ST", "ZIP", "COUNTRY", "EXTERN_ID", "GEN", "DOBY"];

export const IDENTIFYING_KEYS: MatchKey[] = ["EMAIL", "PHONE", "EXTERN_ID"];

export type ColumnMapping = MatchKey | "";

export interface CustomerListDraft {
  adAccountId: string;
  name: string;
  description?: string;
  source: "crm" | "file";
  fileMediaId?: string;
  columns?: ColumnMapping[];
  skipHeader?: boolean;
  crmFilter: CrmFilter;
}

export interface CustomerListResult {
  audience: Audience;
  matched: number;
  skipped: number;
}

export interface LookalikeDraft {
  adAccountId: string;
  name: string;
  originAudienceId: string;
  percent: number;
  country?: string;
}

export const DEFAULT_LOOKALIKE_COUNTRY = "BR";

export const LOOKALIKE_COUNTRIES = [
  "BR", "AR", "BO", "CL", "CO", "EC", "MX", "PY", "PE", "UY", "VE", "US", "CA", "PT", "ES", "FR", "DE", "IT", "GB", "IE",
  "NL", "BE", "CH", "AT", "AO", "MZ", "JP", "AU",
];

export interface CountryOption {
  code: string;
  name: string;
}

export function countryOptions(locale: string, codes: string[] = LOOKALIKE_COUNTRIES): CountryOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    names = null;
  }
  return codes
    .map((code) => ({ code, name: names?.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

export const MIN_LOOKALIKE_PERCENT = 1;
export const MAX_LOOKALIKE_PERCENT = 10;

export interface SavedAudience {
  id: string;
  name: string;
  targeting: AdDraftTargeting;
  placements: AdPlacements;
  createdAt: string;
  updatedAt: string;
}

export type SavedAudienceInput = Pick<SavedAudience, "name" | "targeting" | "placements">;

export type AudienceSize = { kind: "calculating" } | { kind: "range"; lower: number; upper: number } | { kind: "unknown" };

export function audienceSize(audience: Pick<Audience, "approxLower" | "approxUpper">): AudienceSize {
  const { approxLower: lower, approxUpper: upper } = audience;
  if (lower === -1 || upper === -1) return { kind: "calculating" };
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower < 0 || upper <= 0) return { kind: "unknown" };
  return { kind: "range", lower, upper: Math.max(lower, upper) };
}

export type AudienceState = "ready" | "too_small" | "processing" | "unavailable";

const READY_CODE = 200;
const TOO_SMALL_CODE = 300;
const PROCESSING_CODES = new Set([100, 411, 412, 413, 414]);

export function audienceState(audience: Pick<Audience, "deliveryCode" | "operationCode">): AudienceState {
  if (audience.deliveryCode === READY_CODE) return "ready";
  if (audience.deliveryCode === TOO_SMALL_CODE) return "too_small";
  if (PROCESSING_CODES.has(audience.operationCode) || PROCESSING_CODES.has(audience.deliveryCode)) return "processing";
  return "unavailable";
}

export function clampLookalikePercent(value: number): number {
  if (!Number.isFinite(value)) return MIN_LOOKALIKE_PERCENT;
  return Math.min(MAX_LOOKALIKE_PERCENT, Math.max(MIN_LOOKALIKE_PERCENT, Math.round(value)));
}

const DELIMITERS = [",", ";", "\t"];

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  let best = ",";
  let bestCount = 0;
  for (const delimiter of DELIMITERS) {
    let count = 0;
    let quoted = false;
    for (const char of firstLine) {
      if (char === '"') quoted = !quoted;
      else if (!quoted && char === delimiter) count += 1;
    }
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(text: string, maxRows = Number.POSITIVE_INFINITY): string[][] {
  const source = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const endRow = () => {
    row.push(cell.trim());
    cell = "";
    if (row.some((value) => value !== "")) rows.push(row);
    row = [];
  };

  for (let index = 0; index < source.length && rows.length < maxRows; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") endRow();
    else if (char !== "\r") cell += char;
  }
  if (rows.length < maxRows && (cell !== "" || row.length > 0)) endRow();
  return rows;
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const HEADER_HINTS: { key: MatchKey; words: string[] }[] = [
  { key: "EMAIL", words: ["email", "e mail", "mail", "correo", "correo electronico"] },
  { key: "PHONE", words: ["phone", "telefone", "celular", "whatsapp", "fone", "telefono", "mobile", "numero", "number", "telefonnummer"] },
  { key: "FN", words: ["nome", "first name", "firstname", "primeiro nome", "nombre", "vorname", "name", "fn"] },
  { key: "LN", words: ["sobrenome", "last name", "lastname", "ultimo nome", "apellido", "nachname", "ln"] },
  { key: "CT", words: ["cidade", "city", "ciudad", "stadt", "ct"] },
  { key: "ST", words: ["estado", "uf", "state", "provincia", "bundesland", "st"] },
  { key: "ZIP", words: ["cep", "zip", "zipcode", "zip code", "postal", "codigo postal", "plz"] },
  { key: "COUNTRY", words: ["pais", "country", "land"] },
  { key: "EXTERN_ID", words: ["id", "external id", "extern id", "codigo", "customer id", "id cliente"] },
  { key: "GEN", words: ["genero", "sexo", "gender", "geschlecht", "gen"] },
  { key: "DOBY", words: ["ano de nascimento", "ano nascimento", "birth year", "year of birth", "doby", "ano"] },
];

export function guessKeyFromHeader(header: string): ColumnMapping {
  const folded = fold(header);
  if (!folded) return "";
  for (const hint of HEADER_HINTS) {
    if (hint.words.includes(folded)) return hint.key;
  }
  for (const hint of HEADER_HINTS) {
    if (hint.words.some((word) => word.length > 3 && folded.includes(word))) return hint.key;
  }
  return "";
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function looksLikePhone(value: string): boolean {
  if (!/^[+()\d\s.-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function guessKeyFromValues(values: string[]): ColumnMapping {
  const filled = values.map((value) => value.trim()).filter(Boolean);
  if (filled.length === 0) return "";
  const share = (test: (value: string) => boolean) => filled.filter(test).length / filled.length;
  if (share((value) => EMAIL_SHAPE.test(value)) >= 0.5) return "EMAIL";
  if (share(looksLikePhone) >= 0.5) return "PHONE";
  return "";
}

export function looksLikeHeader(rows: string[][]): boolean {
  const first = rows[0];
  if (!first || first.length === 0) return false;
  if (first.some((value) => EMAIL_SHAPE.test(value) || looksLikePhone(value))) return false;
  if (first.some((value) => guessKeyFromHeader(value) !== "")) return true;
  const rest = rows.slice(1);
  return first.some((value, column) => value !== "" && guessKeyFromValues(rest.map((row) => row[column] ?? "")) !== "");
}

export interface CsvPreview {
  hasHeader: boolean;
  headers: string[];
  rows: string[][];
  columns: ColumnMapping[];
}

export const CSV_SAMPLE_ROWS = 5;

export function previewCsv(text: string, header?: boolean, sampleRows = CSV_SAMPLE_ROWS): CsvPreview {
  const parsed = parseCsv(text, sampleRows + 1);
  const hasHeader = header ?? looksLikeHeader(parsed);
  const width = parsed.reduce((max, row) => Math.max(max, row.length), 0);
  const headers = Array.from({ length: width }, (_, column) => (hasHeader ? (parsed[0]?.[column] ?? "") : ""));
  const rows = (hasHeader ? parsed.slice(1) : parsed).slice(0, sampleRows);
  const columns: ColumnMapping[] = [];
  headers.forEach((title, column) => {
    const byHeader = hasHeader ? guessKeyFromHeader(title) : "";
    const guess = byHeader || guessKeyFromValues(rows.map((row) => row[column] ?? ""));
    columns.push(guess !== "" && columns.includes(guess) ? "" : guess);
  });
  return { hasHeader, headers, rows, columns };
}

export function assignColumn(columns: ColumnMapping[], index: number, key: ColumnMapping): ColumnMapping[] {
  return columns.map((current, column) => {
    if (column === index) return key;
    return key !== "" && current === key ? "" : current;
  });
}

export function hasIdentifyingColumn(columns: ColumnMapping[]): boolean {
  return columns.some((key) => key !== "" && IDENTIFYING_KEYS.includes(key));
}

export const AUDIENCE_MIN_AGE = 13;
export const AUDIENCE_MAX_AGE = 65;
export const DEFAULT_MIN_AGE = 18;

export type GenderChoice = "all" | "male" | "female";

export const GENDER_CHOICES: GenderChoice[] = ["all", "male", "female"];

const MALE = 1;
const FEMALE = 2;

export function genderChoiceOf(genders: number[] | null | undefined): GenderChoice {
  const set = new Set(genders ?? []);
  if (set.size === 1 && set.has(MALE)) return "male";
  if (set.size === 1 && set.has(FEMALE)) return "female";
  return "all";
}

export function gendersOf(choice: GenderChoice): number[] | undefined {
  if (choice === "male") return [MALE];
  if (choice === "female") return [FEMALE];
  return undefined;
}

export function emptySavedAudience(): SavedAudienceInput {
  return {
    name: "",
    targeting: { locations: [], ageMin: DEFAULT_MIN_AGE, ageMax: AUDIENCE_MAX_AGE, advantageAudience: true },
    placements: { automatic: true },
  };
}

export function originCandidates(audiences: Audience[]): Audience[] {
  return audiences.filter((audience) => audience.kind !== "LOOKALIKE");
}
