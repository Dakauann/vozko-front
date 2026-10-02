export type MetricDirection = "higher" | "lower" | "neutral";

export type DeltaTone = "better" | "worse" | "neutral";

export interface Delta {
  change: number;
  tone: DeltaTone;
}

const FLAT_EPSILON = 0.05;

export function percentChange(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function deltaOf(
  current: number | null | undefined,
  previous: number | null | undefined,
  direction: MetricDirection,
): Delta | null {
  const change = percentChange(current, previous);
  if (change === null) return null;
  if (direction === "neutral" || Math.abs(change) < FLAT_EPSILON) return { change, tone: "neutral" };
  const improved = direction === "higher" ? change > 0 : change < 0;
  return { change, tone: improved ? "better" : "worse" };
}
