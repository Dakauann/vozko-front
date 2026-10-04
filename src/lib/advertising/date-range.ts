import type { AdRange, AdReportPreset } from "@/lib/advertising/types";

export type RangePreset = AdReportPreset;

export const RANGE_PRESETS: RangePreset[] = [
  "today",
  "yesterday",
  "todayAndYesterday",
  "last7",
  "last14",
  "last28",
  "last30",
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
  "maximum",
  "custom",
];

export const MAXIMUM_MONTHS = 37;

const MONDAY = 1;

export const DEFAULT_PRESET: RangePreset = "last30";

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function isDay(value: string): boolean {
  const match = DAY_PATTERN.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return toDay(date) === value;
}

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fromDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export function addDays(day: string, amount: number): string {
  return toDay(new Date(fromDay(day).getTime() + amount * DAY_MS));
}

export function civilToday(timezone: string, now: Date): string | null {
  if (!timezone.trim()) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const day = `${pick("year")}-${pick("month")}-${pick("day")}`;
    return isDay(day) ? day : null;
  } catch {
    return null;
  }
}

function firstOfMonth(day: string): string {
  return `${day.slice(0, 8)}01`;
}

function startOfWeek(day: string): string {
  const weekday = fromDay(day).getUTCDay();
  return addDays(day, -((weekday - MONDAY + 7) % 7));
}

function addMonths(day: string, amount: number): string {
  const start = fromDay(day);
  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + amount, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  return toDay(target);
}

export function earliestDay(today: string): string {
  return addMonths(today, -MAXIMUM_MONTHS);
}

export function rangeForPreset(preset: Exclude<RangePreset, "custom">, today: string): AdRange {
  switch (preset) {
    case "today":
      return { since: today, until: today };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return { since: yesterday, until: yesterday };
    }
    case "todayAndYesterday":
      return { since: addDays(today, -1), until: today };
    case "last7":
      return { since: addDays(today, -6), until: today };
    case "last14":
      return { since: addDays(today, -13), until: today };
    case "last28":
      return { since: addDays(today, -27), until: today };
    case "last30":
      return { since: addDays(today, -29), until: today };
    case "thisWeek":
      return { since: startOfWeek(today), until: today };
    case "lastWeek": {
      const lastSunday = addDays(startOfWeek(today), -1);
      return { since: startOfWeek(lastSunday), until: lastSunday };
    }
    case "thisMonth":
      return { since: firstOfMonth(today), until: today };
    case "lastMonth": {
      const lastDay = addDays(firstOfMonth(today), -1);
      return { since: firstOfMonth(lastDay), until: lastDay };
    }
    case "maximum":
      return { since: earliestDay(today), until: today };
  }
}

export function validRange(range: AdRange): boolean {
  return isDay(range.since) && isDay(range.until) && range.since <= range.until;
}

export function resolveRange(preset: RangePreset, custom: AdRange, today: string | null): AdRange | null {
  if (!today) return null;
  if (preset !== "custom") return rangeForPreset(preset, today);
  const inside = custom.since >= earliestDay(today) && custom.until <= today;
  return validRange(custom) && inside ? custom : null;
}

export function previousRange(range: AdRange): AdRange | null {
  if (!validRange(range)) return null;
  const days = Math.round((fromDay(range.until).getTime() - fromDay(range.since).getTime()) / DAY_MS) + 1;
  return { since: addDays(range.since, -days), until: addDays(range.since, -1) };
}

export function formatLongDay(day: string, locale: string): string {
  if (!isDay(day)) return day;
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(fromDay(day));
}

export function formatDay(day: string, locale: string): string {
  if (!isDay(day)) return day;
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", timeZone: "UTC" }).format(fromDay(day));
}

function zoneOffsetMs(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour"), pick("minute"), pick("second"));
  return asUtc - instant;
}

export function zonedDayStart(day: string, timezone: string): string | null {
  if (!isDay(day) || !timezone.trim()) return null;
  try {
    const guess = fromDay(day).getTime();
    const first = guess - zoneOffsetMs(guess, timezone);
    const settled = guess - zoneOffsetMs(first, timezone);
    return new Date(settled).toISOString();
  } catch {
    return null;
  }
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 30],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

export function relativeSince(iso: string | undefined, now: Date, locale: string): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  let amount = Math.max(0, Math.round((now.getTime() - then) / 1000));
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, size] of RELATIVE_STEPS) {
    if (amount < size) return format.format(-amount, unit);
    amount = Math.floor(amount / size);
  }
  return null;
}

export function dayToLocalDate(day: string): Date | null {
  const match = DAY_PATTERN.exec(day);
  if (!match || !isDay(day)) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function localDateToDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
