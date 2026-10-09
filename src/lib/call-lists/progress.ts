import { CALL_LIST_SKIP_REASONS, type CallList } from "./types";

export interface CallListProgress {
  total: number;
  open: number;
  closed: number;
  skipped: number;
  percent: number;
}

export function callListProgress(list: CallList): CallListProgress {
  const total = list.itemCount;
  const closed = list.closedCount;
  const skipped = Object.values(list.skipped).reduce((sum, count) => sum + count, 0);
  const percent = total > 0 ? Math.floor((closed / total) * 100) : 0;
  return { total, open: list.openCount, closed, skipped, percent };
}

export type SkippedReason = (typeof CALL_LIST_SKIP_REASONS)[number] | "other";

export interface SkippedCount {
  reason: SkippedReason;
  count: number;
}

const KNOWN_REASONS: readonly string[] = CALL_LIST_SKIP_REASONS;

export function skippedReasons(skipped: Record<string, number>): SkippedCount[] {
  const known: SkippedCount[] = [];
  let other = 0;
  for (const [reason, count] of Object.entries(skipped)) {
    if (count <= 0) continue;
    if (KNOWN_REASONS.includes(reason)) known.push({ reason: reason as SkippedReason, count });
    else other += count;
  }
  known.sort((a, b) => b.count - a.count);
  return other > 0 ? [...known, { reason: "other", count: other }] : known;
}
