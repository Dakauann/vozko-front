import type { AdRange } from "@/lib/advertising/types";

export type RangePreset = "today" | "yesterday" | "last7" | "last14" | "last30" | "thisMonth" | "lastMonth" | "custom";

export const RANGE_PRESETS: RangePreset[] = ["today", "yesterday", "last7", "last14", "last30", "thisMonth", "lastMonth", "custom"];

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

export function rangeForPreset(preset: Exclude<RangePreset, "custom">, today: string): AdRange {
  switch (preset) {
    case "today":
      return { since: today, until: today };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return { since: yesterday, until: yesterday };
    }
    case "last7":
      return { since: addDays(today, -6), until: today };
    case "last14":
      return { since: addDays(today, -13), until: today };
    case "last30":
      return { since: addDays(today, -29), until: today };
    case "thisMonth":
      return { since: firstOfMonth(today), until: today };
    case "lastMonth": {
      const lastDay = addDays(firstOfMonth(today), -1);
      return { since: firstOfMonth(lastDay), until: lastDay };
    }
  }
}

export function validRange(range: AdRange): boolean {
  return isDay(range.since) && isDay(range.until) && range.since <= range.until;
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
