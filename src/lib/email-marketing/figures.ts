import type { EmailDailyPoint } from "./types";

const BASIS_POINTS_PER_UNIT = 10_000;

export function rateFraction(basisPoints: number): number {
  return basisPoints / BASIS_POINTS_PER_UNIT;
}

export interface ReputationScale {
  valueShare: number;
  warningShare: number;
  limitShare: number;
}

export function reputationScale(rate: number, warning: number, limit: number): ReputationScale {
  const top = Math.max(limit * 2, rate, 1);
  return { valueShare: Math.min(rate / top, 1), warningShare: Math.min(warning / top, 1), limitShare: limit / top };
}

export function hasTraffic(daily: readonly EmailDailyPoint[]): boolean {
  return daily.some((point) => point.sent > 0 || point.delivered > 0 || point.opens > 0 || point.clicks > 0);
}
