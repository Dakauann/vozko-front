import { changeStampOf, readChangeStampFields, readOptionalInstant, readOptionalText, type ChangeStamp } from "./change-stamp";

export interface GeocodingSettings {
  provider: string;
  enabled: boolean;
  providerChangedBy?: string;
  providerChangedByName?: string;
  providerChangedAt?: string;
  monthlyCeiling: number;
  ceilingChangedBy?: string;
  ceilingChangedByName?: string;
  ceilingChangedAt?: string;
  dailyShare: number;
  usedThisCycle: number;
  usedToday: number;
  exhausted: GeocodingExhaustion;
  cycleStart?: string;
  nextCycleStart?: string;
  availableProviders: string[];
  attribution: string;
  canChangeProvider: boolean;
  canChangeCeiling: boolean;
  providerPause: GeocodingProviderPause | null;
}

export const GEOCODING_PAUSE_REASONS = ["key_rejected", "account_quota_spent", "key_disabled", "account_refused", "queries_refused"] as const;

export type GeocodingPauseReason = (typeof GEOCODING_PAUSE_REASONS)[number] | "other";

export type GeocodingProviderPause = { state: "paused"; reason: GeocodingPauseReason; since: string; until: string } | { state: "unknown" };

export interface GeocodingChange {
  provider?: string;
  monthlyCeiling?: number;
}

export const GEOCODING_EXHAUSTIONS = ["", "monthly", "daily"] as const;

export type GeocodingExhaustion = (typeof GEOCODING_EXHAUSTIONS)[number];

export type GeocodingUsageState = "off" | "none" | "open" | "reached" | "todayReached";

export interface GeocodingUsage {
  percent: number | null;
  state: GeocodingUsageState;
}

const VERDICTS = ["enabled", "canChangeProvider", "canChangeCeiling"] as const;
const COUNTS = ["monthlyCeiling", "dailyShare", "usedThisCycle", "usedToday"] as const;
const TEXTS = ["provider", "attribution"] as const;
const CYCLE = ["cycleStart", "nextCycleStart"] as const;
const STAMPED = ["provider", "ceiling"] as const;

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isExhaustion(value: unknown): value is GeocodingExhaustion {
  return GEOCODING_EXHAUSTIONS.some((known) => known === value);
}

function isNameList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPauseReason(value: unknown): value is (typeof GEOCODING_PAUSE_REASONS)[number] {
  return GEOCODING_PAUSE_REASONS.some((known) => known === value);
}

function readRequiredInstant(value: unknown): string | null {
  const read = readOptionalInstant(value);
  return read.ok && read.text !== undefined ? read.text : null;
}

function readProviderPause(value: unknown): { ok: true; pause: GeocodingProviderPause | null } | { ok: false } {
  if (value === null) return { ok: true, pause: null };
  if (typeof value !== "object" || Array.isArray(value)) return { ok: false };
  const raw = value as Record<string, unknown>;
  if (raw.state === "unknown") return { ok: true, pause: { state: "unknown" } };
  if (raw.state !== "paused") return { ok: false };
  const reason = readOptionalText(raw.reason);
  const since = readRequiredInstant(raw.since);
  const until = readRequiredInstant(raw.until);
  if (!reason.ok || since === null || until === null) return { ok: false };
  return { ok: true, pause: { state: "paused", reason: isPauseReason(reason.text) ? reason.text : "other", since, until } };
}

export function readGeocodingSettings(value: unknown): GeocodingSettings | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (VERDICTS.some((key) => typeof raw[key] !== "boolean")) return null;
  if (COUNTS.some((key) => !isCount(raw[key]))) return null;
  if (TEXTS.some((key) => typeof raw[key] !== "string")) return null;
  if (!isNameList(raw.availableProviders)) return null;
  if (!isExhaustion(raw.exhausted)) return null;

  const settings: Record<string, unknown> = { availableProviders: [...raw.availableProviders], exhausted: raw.exhausted };
  for (const key of [...VERDICTS, ...COUNTS, ...TEXTS]) settings[key] = raw[key];
  for (const key of CYCLE) {
    const read = readOptionalInstant(raw[key]);
    if (!read.ok) return null;
    settings[key] = read.text;
  }
  for (const prefix of STAMPED) {
    const stamp = readChangeStampFields(raw, prefix);
    if (!stamp) return null;
    Object.assign(settings, stamp);
  }
  if (!("providerPause" in raw)) return null;
  const pause = readProviderPause(raw.providerPause);
  if (!pause.ok) return null;
  settings.providerPause = pause.pause;
  return settings as unknown as GeocodingSettings;
}

export function providerToEnable(settings: GeocodingSettings): string | null {
  if (settings.provider !== "" && settings.availableProviders.includes(settings.provider)) return settings.provider;
  return settings.availableProviders[0] ?? null;
}

export function providerMissing(settings: GeocodingSettings): boolean {
  return settings.enabled && !settings.availableProviders.includes(settings.provider);
}

const EXHAUSTION_STATE: Record<GeocodingExhaustion, GeocodingUsageState> = {
  "": "open",
  monthly: "reached",
  daily: "todayReached",
};

export function geocodingUsage(settings: GeocodingSettings): GeocodingUsage {
  if (!settings.enabled) return { percent: null, state: "off" };
  if (settings.monthlyCeiling === 0) return { percent: null, state: "none" };
  const percent = Math.min(100, (settings.usedThisCycle / settings.monthlyCeiling) * 100);
  return { percent, state: EXHAUSTION_STATE[settings.exhausted] };
}

const CEILING_TEXT = /^\d+$/;

export function readCeilingInput(text: string): number | null {
  const trimmed = text.trim();
  if (!CEILING_TEXT.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

export function geocodingProviderStamp(settings: GeocodingSettings): ChangeStamp | null {
  return changeStampOf(settings, "provider");
}

export function geocodingCeilingStamp(settings: GeocodingSettings): ChangeStamp | null {
  return changeStampOf(settings, "ceiling");
}
