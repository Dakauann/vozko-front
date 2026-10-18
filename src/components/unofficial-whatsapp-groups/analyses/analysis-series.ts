import type {
  AlertLevel,
  AnalysisRun,
  GroupRef,
  ParticipantTotal,
  TrackedField,
  TrendPoint,
} from "@/lib/unofficial-whatsapp-groups/types";

export const ALERT_ORDER = ["low", "medium", "high"] as const satisfies readonly AlertLevel[];

type CustomValue = string | number | boolean | null | undefined;

export interface SeriesPoint<V> {
  cycle: number;
  at: string;
  value: V | null;
}

export type TrackedSeries =
  | { key: string; type: "number" | "percentage"; points: SeriesPoint<number>[]; latest: number | null; answered: number }
  | { key: string; type: "boolean"; points: SeriesPoint<boolean>[]; trueCount: number; answered: number; trueShare: number | null }
  | { key: string; type: "text"; values: { cycle: number; at: string; value: string }[] };

function numberValue(raw: CustomValue): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function booleanValue(raw: CustomValue): boolean | null {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const text = raw.trim().toLowerCase();
    if (text === "true") return true;
    if (text === "false") return false;
  }
  return null;
}

function textValue(raw: CustomValue): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  return text === "" ? null : text;
}

function completedRuns(runs: AnalysisRun[]): AnalysisRun[] {
  return runs
    .filter((run) => run.status === "completed" && run.result)
    .slice()
    .sort((a, b) => {
      const byTime = new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
      return byTime !== 0 ? byTime : a.cycle - b.cycle;
    });
}

function share(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

export function trackedFieldSeries(fields: TrackedField[], runs: AnalysisRun[]): TrackedSeries[] {
  const ordered = completedRuns(runs);
  const valueOf = (run: AnalysisRun, key: string): CustomValue => run.result?.customFields?.[key];

  return fields.map((field): TrackedSeries => {
    if (field.type === "number" || field.type === "percentage") {
      const points = ordered.map((run) => ({ cycle: run.cycle, at: run.completedAt, value: numberValue(valueOf(run, field.key)) }));
      const answeredPoints = points.filter((point) => point.value !== null);
      return {
        key: field.key,
        type: field.type,
        points,
        latest: answeredPoints.at(-1)?.value ?? null,
        answered: answeredPoints.length,
      };
    }
    if (field.type === "boolean") {
      const points = ordered.map((run) => ({ cycle: run.cycle, at: run.completedAt, value: booleanValue(valueOf(run, field.key)) }));
      const answered = points.filter((point) => point.value !== null).length;
      const trueCount = points.filter((point) => point.value === true).length;
      return {
        key: field.key,
        type: "boolean",
        points,
        trueCount,
        answered,
        trueShare: answered > 0 ? share(trueCount, answered) : null,
      };
    }
    const values = ordered
      .map((run) => ({ cycle: run.cycle, at: run.completedAt, value: textValue(valueOf(run, field.key)) }))
      .filter((entry): entry is { cycle: number; at: string; value: string } => entry.value !== null)
      .reverse();
    return { key: field.key, type: "text", values };
  });
}

export function sentimentShares<K extends string>(counts: Partial<Record<K, number>>, order: readonly K[]) {
  const total = order.reduce((sum, key) => sum + Math.max(0, counts[key] ?? 0), 0);
  return {
    total,
    rows: order.map((key) => {
      const value = Math.max(0, counts[key] ?? 0);
      return { key, value, share: share(value, total) };
    }),
  };
}

export function dominantOf<K extends string>(counts: Partial<Record<K, number>>, order: readonly K[]): K | null {
  let best: K | null = null;
  let bestValue = 0;
  for (const key of order) {
    const value = Math.max(0, counts[key] ?? 0);
    if (value > bestValue) {
      best = key;
      bestValue = value;
    }
  }
  return best;
}

export function multiGroupCount(participantGroups: Record<string, GroupRef[]>): number {
  return Object.values(participantGroups).filter((groups) => groups.length >= 2).length;
}

export function mergeParticipantGroups(...maps: Record<string, GroupRef[]>[]): Record<string, GroupRef[]> {
  const merged: Record<string, GroupRef[]> = {};
  for (const map of maps) {
    for (const [jid, groups] of Object.entries(map)) {
      const current = merged[jid] ?? [];
      const seen = new Set(current.map((group) => group.groupId));
      merged[jid] = [...current, ...groups.filter((group) => !seen.has(group.groupId) && seen.add(group.groupId))];
    }
  }
  return merged;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function windowSince(days: number, now: Date): number | null {
  return days > 0 ? now.getTime() - days * DAY_MS : null;
}

export function splitByWindow(runs: AnalysisRun[], since: number | null): { runs: AnalysisRun[]; passed: boolean } {
  if (since === null) return { runs, passed: false };
  const inside = runs.filter((run) => new Date(run.completedAt).getTime() >= since);
  return { runs: inside, passed: inside.length < runs.length };
}

export function latestFailure(runs: AnalysisRun[]): string | undefined {
  return runs.find((run) => run.status === "failed" && run.failureReason)?.failureReason;
}

export function numericStats(points: SeriesPoint<number>[]): { min: number; max: number; avg: number } | null {
  const values = points.map((point) => point.value).filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return { min: Math.min(...values), max: Math.max(...values), avg: sum / values.length };
}

export interface CycleHighlights {
  busiest: TrendPoint | null;
  best: TrendPoint | null;
  worst: TrendPoint | null;
}

export function cycleHighlights(trend: TrendPoint[]): CycleHighlights {
  const pick = (better: (candidate: TrendPoint, current: TrendPoint) => boolean) =>
    trend.reduce<TrendPoint | null>((current, candidate) => (current === null || better(candidate, current) ? candidate : current), null);
  return {
    busiest: pick((candidate, current) => candidate.messages > current.messages),
    best: pick((candidate, current) => candidate.positivity > current.positivity),
    worst: pick((candidate, current) => candidate.positivity < current.positivity),
  };
}

export function perCycle(messages: number, completed: number): number | null {
  return completed > 0 ? messages / completed : null;
}

export type ParticipantSortKey = "name" | "messages";

export interface ParticipantSort {
  key: ParticipantSortKey;
  direction: "asc" | "desc";
}

export function sortParticipants(participants: ParticipantTotal[], sort: ParticipantSort): ParticipantTotal[] {
  const byName = (a: ParticipantTotal, b: ParticipantTotal) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const sign = sort.direction === "asc" ? 1 : -1;
  return participants.slice().sort((a, b) => {
    if (sort.key === "name") return sign * byName(a, b);
    const byMessages = sign * (a.messages - b.messages);
    return byMessages !== 0 ? byMessages : byName(a, b);
  });
}

export function nextParticipantSort(current: ParticipantSort, key: ParticipantSortKey): ParticipantSort {
  if (current.key === key) return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  return { key, direction: key === "name" ? "asc" : "desc" };
}
