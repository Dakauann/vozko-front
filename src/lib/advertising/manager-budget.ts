export const DAILY_PEAK_FACTOR = 1.75;
export const WEEKLY_FACTOR = 7;
export const DAILY_BUDGET_HELP_URL = "https://www.facebook.com/business/help/190490051321426";

export function dailySpendLimits(daily: number): { day: number; week: number } | null {
  if (!Number.isFinite(daily) || daily <= 0) return null;
  return { day: Math.round(daily * DAILY_PEAK_FACTOR), week: Math.round(daily * WEEKLY_FACTOR) };
}
