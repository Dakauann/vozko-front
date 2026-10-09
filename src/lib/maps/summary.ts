import type { GeoSummary, ToneKey } from "./types";

export type OffMapKey = "approximate" | "withoutAddress" | "notFound" | "pending" | "quotaExceeded" | "refused";

export interface OffMapRow {
  key: OffMapKey;
  count: number;
}

const ALWAYS_LISTED: OffMapKey[] = ["approximate", "withoutAddress", "notFound", "pending"];

const LISTED_WHEN_PRESENT: OffMapKey[] = ["quotaExceeded", "refused"];

export function presentOffMapKeys(summary: GeoSummary): OffMapKey[] {
  return LISTED_WHEN_PRESENT.filter((key) => summary[key] > 0);
}

export function offMapRows(summary: GeoSummary): OffMapRow[] {
  return [...ALWAYS_LISTED, ...presentOffMapKeys(summary)].map((key) => ({ key, count: summary[key] }));
}

export interface ColourLegendRow {
  key: string;
  label: string | null;
  count: number;
  tone: ToneKey;
}
