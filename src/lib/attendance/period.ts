import { format, subDays } from "date-fns";

export type PeriodPreset = "7d" | "30d" | "90d";

const DAYS_BEFORE_TODAY: Record<PeriodPreset, number> = { "7d": 6, "30d": 29, "90d": 89 };

export interface PeriodRange {
  dateFrom: string;
  dateTo: string;
}

export function presetRange(preset: PeriodPreset, now: Date = new Date()): PeriodRange {
  return {
    dateFrom: format(subDays(now, DAYS_BEFORE_TODAY[preset]), "yyyy-MM-dd"),
    dateTo: format(now, "yyyy-MM-dd"),
  };
}
