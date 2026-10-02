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

export interface BreakdownSlice {
  key: string;
  values: string[];
  spend: number;
  impressions: number;
  linkClicks: number;
  results: number | null;
  costPerResult: number | null;
  cpm: number | null;
  reach: number | null;
  share: number;
}

function sliceKey(row: AdLiveRow, breakdowns: string[]): string[] {
  return breakdowns.map((breakdown) => row.dimensions?.[breakdown] ?? "");
}

export function aggregateBreakdown(rows: AdLiveRow[] | null | undefined, breakdowns: string[]): BreakdownSlice[] {
  const groups = new Map<string, AdLiveRow[]>();
  for (const row of rows ?? []) {
    if (isTotalRow(row)) continue;
    const key = JSON.stringify(sliceKey(row, breakdowns));
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const slices = Array.from(groups.entries()).map(([key, members]) => {
    const spend = members.reduce((sum, row) => sum + row.metrics.spend, 0);
    const impressions = members.reduce((sum, row) => sum + row.metrics.impressions, 0);
    const linkClicks = members.reduce((sum, row) => sum + row.metrics.linkClicks, 0);
    const actions = new Set(members.map((row) => row.metrics.resultAction));
    const comparable = actions.size === 1 && members.every((row) => !row.metrics.mixedResults && row.metrics.resultAction);
    const results = comparable ? members.reduce((sum, row) => sum + row.metrics.results, 0) : null;
    const singleObject = new Set(members.map((row) => row.objectId)).size === 1;
    return {
      key,
      values: JSON.parse(key) as string[],
      spend,
      impressions,
      linkClicks,
      results,
      costPerResult: results ? Math.round(spend / results) : null,
      cpm: impressions > 0 ? Math.round((spend / impressions) * 1000) : null,
      reach: singleObject ? members[0].reach : null,
      share: 0,
    };
  });
  const totalSpend = slices.reduce((sum, slice) => sum + slice.spend, 0);
  return slices
    .map((slice) => ({ ...slice, share: totalSpend > 0 ? slice.spend / totalSpend : 0 }))
    .sort((a, b) => b.spend - a.spend || a.key.localeCompare(b.key));
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
