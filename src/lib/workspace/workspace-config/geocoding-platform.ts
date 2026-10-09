import type { CodedError } from "@/lib/api/coded-error";

import { readOptionalInstant } from "./change-stamp";
import type { GeocodingUsage } from "./geocoding";

export interface GeocodingPlatformMonth {
  cycleStart: string;
  requests: number;
}

export interface GeocodingPlatformCoverage {
  total: number;
  withAddress: number;
  withoutAddress: number;
  onMap: number;
  approximate: number;
  pending: number;
  notFound: number;
  quotaExceeded: number;
  refused: number;
  addressShare: number;
  mapShare: number;
}

export interface GeocodingPlatformWorkspace {
  workspaceId: string;
  workspaceName: string;
  provider: string;
  enabled: boolean;
  monthlyCeiling: number;
  ceilingSet: boolean;
  providerChangedAt?: string;
  usedThisCycle: number;
  usedToday: number;
  months: GeocodingPlatformMonth[];
  coverage: GeocodingPlatformCoverage;
}

export interface GeocodingPlatformPage {
  cycleStart: string;
  nextCycleStart: string;
  today: string;
  cycles: string[];
  items: GeocodingPlatformWorkspace[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type GeocodingPlatformErrorKey = "forbidden" | "unavailable" | "busy" | "slow" | "default";

const COVERAGE_COUNTS = ["total", "withAddress", "withoutAddress", "onMap", "approximate", "pending", "notFound", "quotaExceeded", "refused"] as const;
const COVERAGE_SHARES = ["addressShare", "mapShare"] as const;
const WORKSPACE_TEXTS = ["workspaceId", "workspaceName", "provider"] as const;
const WORKSPACE_VERDICTS = ["enabled", "ceilingSet"] as const;
const WORKSPACE_COUNTS = ["monthlyCeiling", "usedThisCycle", "usedToday"] as const;
const PAGE_INSTANTS = ["cycleStart", "nextCycleStart", "today"] as const;
const PAGE_COUNTS = ["page", "pageSize", "totalItems", "totalPages"] as const;

type Raw = Record<string, unknown>;

function recordOf(value: unknown): Raw | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : null;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isShare(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function instantOf(value: unknown): string | null {
  const read = readOptionalInstant(value);
  return read.ok && read.text !== undefined ? read.text : null;
}

function readCoverage(value: unknown): GeocodingPlatformCoverage | null {
  const raw = recordOf(value);
  if (!raw) return null;
  if (COVERAGE_COUNTS.some((key) => !isCount(raw[key]))) return null;
  if (COVERAGE_SHARES.some((key) => !isShare(raw[key]))) return null;
  const out: Raw = {};
  for (const key of [...COVERAGE_COUNTS, ...COVERAGE_SHARES]) out[key] = raw[key];
  return out as unknown as GeocodingPlatformCoverage;
}

function readMonth(value: unknown): GeocodingPlatformMonth | null {
  const raw = recordOf(value);
  const cycleStart = raw ? instantOf(raw.cycleStart) : null;
  if (!raw || cycleStart === null || !isCount(raw.requests)) return null;
  return { cycleStart, requests: raw.requests };
}

function readList<T>(value: unknown, read: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const item of value) {
    const parsed = read(item);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

function readWorkspace(value: unknown): GeocodingPlatformWorkspace | null {
  const raw = recordOf(value);
  if (!raw) return null;
  if (WORKSPACE_TEXTS.some((key) => typeof raw[key] !== "string")) return null;
  if (WORKSPACE_VERDICTS.some((key) => typeof raw[key] !== "boolean")) return null;
  if (WORKSPACE_COUNTS.some((key) => !isCount(raw[key]))) return null;
  const changedAt = readOptionalInstant(raw.providerChangedAt);
  const months = readList(raw.months, readMonth);
  const coverage = readCoverage(raw.coverage);
  if (!changedAt.ok || months === null || coverage === null) return null;
  const out: Raw = { months, coverage, providerChangedAt: changedAt.text };
  for (const key of [...WORKSPACE_TEXTS, ...WORKSPACE_VERDICTS, ...WORKSPACE_COUNTS]) out[key] = raw[key];
  return out as unknown as GeocodingPlatformWorkspace;
}

export function readGeocodingPlatformPage(value: unknown): GeocodingPlatformPage | null {
  const raw = recordOf(value);
  if (!raw) return null;
  if (PAGE_COUNTS.some((key) => !isCount(raw[key]))) return null;
  const instants: Raw = {};
  for (const key of PAGE_INSTANTS) {
    const instant = instantOf(raw[key]);
    if (instant === null) return null;
    instants[key] = instant;
  }
  const cycles = readList(raw.cycles, instantOf);
  const items = readList(raw.items, readWorkspace);
  if (cycles === null || items === null) return null;
  const out: Raw = { ...instants, cycles, items };
  for (const key of PAGE_COUNTS) out[key] = raw[key];
  return out as unknown as GeocodingPlatformPage;
}

export function geocodingPlatformUsage(item: Pick<GeocodingPlatformWorkspace, "enabled" | "usedThisCycle" | "monthlyCeiling">): GeocodingUsage {
  if (!item.enabled) return { percent: null, state: "off" };
  if (item.monthlyCeiling <= 0) return { percent: null, state: "none" };
  const percent = Math.min(100, (item.usedThisCycle / item.monthlyCeiling) * 100);
  return { percent, state: item.usedThisCycle >= item.monthlyCeiling ? "reached" : "open" };
}

export function geocodingPlatformErrorKey(error: CodedError): GeocodingPlatformErrorKey {
  if (error.status === 403) return "forbidden";
  if (error.code === "geocoding_unavailable") return "unavailable";
  if (error.status === 503) return "busy";
  if (error.status === 504) return "slow";
  return "default";
}
