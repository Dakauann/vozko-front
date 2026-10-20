const DAY_MS = 86_400_000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface Period {
  from: string;
  to: string;
}

export interface PeriodLimitCheck {
  exceeded: boolean;
  days: number;
  window: Period;
}

function dayNumber(day: string): number {
  if (!DAY_PATTERN.test(day)) return Number.NaN;
  return Date.parse(`${day}T00:00:00Z`) / DAY_MS;
}

function dayString(dayNum: number): string {
  return new Date(dayNum * DAY_MS).toISOString().slice(0, 10);
}

export function periodDays(from: string, to: string): number {
  const days = dayNumber(to) - dayNumber(from) + 1;
  return Number.isFinite(days) ? days : 0;
}

export function checkPeriodLimit(from: string, to: string, maxDays: number): PeriodLimitCheck {
  const days = periodDays(from, to);
  if (days <= maxDays) {
    return { exceeded: false, days, window: { from, to } };
  }
  return { exceeded: true, days, window: { from: dayString(dayNumber(to) - (maxDays - 1)), to } };
}

export type PeriodLimitReportState = "idle" | "requesting" | "queued";

export interface PeriodLimitReport {
  state: PeriodLimitReportState;
  onRequest: () => void;
}

export type PeriodUnit = "days" | "months" | "years";

export type PeriodAmount = { limit: number; unit: PeriodUnit };

const PER_YEAR: Partial<Record<PeriodUnit, number>> = { days: 365, months: 12 };

export function wholeUnitAmount(limit: number, unit: PeriodUnit): PeriodAmount {
  const perYear = PER_YEAR[unit];
  if (perYear && limit >= perYear && limit % perYear === 0) return { limit: limit / perYear, unit: "years" };
  return { limit, unit };
}

export function windowShare(windowDays: number, spanDays: number): number {
  if (spanDays <= 0) return 1;
  return Math.min(1, windowDays / spanDays);
}
