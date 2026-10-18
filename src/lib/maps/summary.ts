import type { GeoSummary, ToneKey } from "./types";

export type OffMapKey = "approximate" | "withoutAddress" | "notFound" | "pending";

interface OffMapRow {
  key: OffMapKey;
  count: number;
}

const OFF_MAP_KEYS: OffMapKey[] = ["approximate", "withoutAddress", "notFound", "pending"];

export function offMapRows(summary: GeoSummary): OffMapRow[] {
  return OFF_MAP_KEYS.map((key) => ({ key, count: summary[key] }));
}

export interface ColourLegendRow {
  key: string;
  label: string | null;
  count: number;
  tone: ToneKey;
}
