import { formatISO, subDays } from "date-fns";

export type PeriodPreset = "7d" | "30d" | "90d";

const DAYS_BEFORE_TODAY: Record<PeriodPreset, number> = { "7d": 6, "30d": 29, "90d": 89 };

export interface PeriodRange {
  dateFrom: string;
  dateTo: string;
}

export function presetRange(preset: PeriodPreset, now: Date = new Date()): PeriodRange {
  return {
    dateFrom: formatISO(subDays(now, DAYS_BEFORE_TODAY[preset]), { representation: "date" }),
    dateTo: formatISO(now, { representation: "date" }),
  };
}

export const CALENDAR_WINDOW_DAYS = 3650;

const SPAN_REFUSAL = "range_too_wide";

export function refusedForSpan(reason: string | undefined): boolean {
  return reason === SPAN_REFUSAL;
}
