import type { CodedError } from "@/lib/api/coded-error";

export interface GeocodingPlatformCoverage {
  total: number;
  withAddress: number;
  withoutAddress: number;
  onMap: number;
  approximate: number;
  pending: number;
  notFound: number;
  addressShare: number;
  mapShare: number;
}

export interface GeocodingPlatformWorkspace {
  workspaceId: string;
  workspaceName: string;
  coverage: GeocodingPlatformCoverage;
}

export interface GeocodingPlatformPage {
  items: GeocodingPlatformWorkspace[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

type GeocodingPlatformErrorKey = "forbidden" | "unavailable" | "busy" | "slow" | "default";

const COVERAGE_COUNTS = ["total", "withAddress", "withoutAddress", "onMap", "approximate", "pending", "notFound"] as const;
const COVERAGE_SHARES = ["addressShare", "mapShare"] as const;
const WORKSPACE_TEXTS = ["workspaceId", "workspaceName"] as const;
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

function readCoverage(value: unknown): GeocodingPlatformCoverage | null {
  const raw = recordOf(value);
  if (!raw) return null;
  if (COVERAGE_COUNTS.some((key) => !isCount(raw[key]))) return null;
  if (COVERAGE_SHARES.some((key) => !isShare(raw[key]))) return null;
  const out: Raw = {};
  for (const key of [...COVERAGE_COUNTS, ...COVERAGE_SHARES]) out[key] = raw[key];
  return out as unknown as GeocodingPlatformCoverage;
}

function readWorkspace(value: unknown): GeocodingPlatformWorkspace | null {
  const raw = recordOf(value);
  if (!raw) return null;
  if (WORKSPACE_TEXTS.some((key) => typeof raw[key] !== "string")) return null;
  const coverage = readCoverage(raw.coverage);
  if (coverage === null) return null;
  return { workspaceId: raw.workspaceId as string, workspaceName: raw.workspaceName as string, coverage };
}

export function readGeocodingPlatformPage(value: unknown): GeocodingPlatformPage | null {
  const raw = recordOf(value);
  if (!raw || !Array.isArray(raw.items)) return null;
  if (PAGE_COUNTS.some((key) => !isCount(raw[key]))) return null;
  const items: GeocodingPlatformWorkspace[] = [];
  for (const item of raw.items) {
    const parsed = readWorkspace(item);
    if (parsed === null) return null;
    items.push(parsed);
  }
  const out: Raw = { items };
  for (const key of PAGE_COUNTS) out[key] = raw[key];
  return out as unknown as GeocodingPlatformPage;
}

export function geocodingPlatformErrorKey(error: CodedError): GeocodingPlatformErrorKey {
  if (error.status === 403) return "forbidden";
  if (error.code === "geocoding_unavailable") return "unavailable";
  if (error.status === 503) return "busy";
  if (error.status === 504) return "slow";
  return "default";
}
