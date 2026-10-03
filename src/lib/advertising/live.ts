import type { AdLiveRow, AdRow } from "@/lib/advertising/types";

export const LIVE_COLUMNS = [
  "reach",
  "frequency",
  "videoPlays",
  "thruPlays",
  "costPerThruPlay",
  "videoP25",
  "videoP50",
  "videoP75",
  "videoP100",
  "avgWatchSeconds",
] as const;

export type LiveColumn = (typeof LIVE_COLUMNS)[number];

export type LiveFetch = "idle" | "loading" | "ready" | "failed";

export type ManagerRow = AdRow & { live: AdLiveRow | null };

export function isLiveColumn(value: unknown): value is LiveColumn {
  return typeof value === "string" && (LIVE_COLUMNS as readonly string[]).includes(value);
}

function isTotalRow(row: AdLiveRow): boolean {
  return !row.dimensions || Object.keys(row.dimensions).length === 0;
}

export function liveById(rows: AdLiveRow[] | null | undefined): Map<string, AdLiveRow> {
  const map = new Map<string, AdLiveRow>();
  for (const row of rows ?? []) {
    if (isTotalRow(row)) map.set(row.objectId, row);
  }
  return map;
}

export function mergeLiveRows(rows: AdRow[], live: Map<string, AdLiveRow> | null): ManagerRow[] {
  return rows.map((row) => ({ ...row, live: live?.get(row.metaId) ?? null }));
}

export function liveValue(live: AdLiveRow | null, column: LiveColumn): number | null {
  if (!live) return null;
  switch (column) {
    case "reach":
      return live.reach;
    case "frequency":
      return live.frequency;
    case "videoPlays":
      return live.video.plays;
    case "thruPlays":
      return live.video.thruPlays;
    case "costPerThruPlay":
      return live.costPerThruPlay;
    case "videoP25":
      return live.video.p25;
    case "videoP50":
      return live.video.p50;
    case "videoP75":
      return live.video.p75;
    case "videoP100":
      return live.video.p100;
    case "avgWatchSeconds":
      return live.video.avgWatchSeconds;
  }
}

export function withLiveResults(row: ManagerRow): ManagerRow {
  const live = row.live?.metrics;
  return {
    ...row,
    metrics: {
      ...row.metrics,
      results: live?.results ?? 0,
      resultAction: live?.resultAction ?? "",
      mixedResults: live?.mixedResults ?? false,
      costPerResult: live?.costPerResult ?? null,
    },
  };
}
