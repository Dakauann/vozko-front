import { MAX_MONEY_FRACTION_DIGITS, visibleFractionDigits } from "@/lib/format/money";
import { microsToBrl } from "@/lib/pricing/currency";

import type { TimelineBucket } from "./types";

export { basisPointsToPercent, formatBasisPoints, formatPercent } from "@/lib/format/basis-points";

const TRACKING_PARAM_PREFIX = "utm_";

export function share(part: number, whole: number): number {
  if (whole <= 0 || part <= 0) return 0;
  return Math.min(100, (part / whole) * 100);
}

function brlFormat(locale: string, minimum: number, maximum: number): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL", minimumFractionDigits: minimum, maximumFractionDigits: maximum });
}

export function formatBrl(reais: number | null | undefined, locale: string, fractionDigits = 2, distinctFrom?: number): string | null {
  if (reais === null || reais === undefined || !Number.isFinite(reais)) return null;
  return brlFormat(locale, fractionDigits, visibleFractionDigits(reais, Math.max(fractionDigits, 2), distinctFrom)).format(reais);
}

export function formatBrlMicros(micros: number, exchangeRate: number | null, locale: string, fractionDigits = 2): string | null {
  return formatBrl(microsToBrl(Math.max(0, micros), exchangeRate), locale, fractionDigits);
}

export function formatUnitBrlMicros(micros: number, exchangeRate: number | null, locale: string): string | null {
  return formatBrlMicros(micros, exchangeRate, locale, MAX_MONEY_FRACTION_DIGITS);
}

export function formatUnitBrl(reais: number | null | undefined, locale: string): string | null {
  if (reais === null || reais === undefined || !Number.isFinite(reais)) return null;
  return brlFormat(locale, 2, MAX_MONEY_FRACTION_DIGITS).format(reais);
}

const TICK_FORMAT: Record<TimelineBucket, Intl.DateTimeFormatOptions> = {
  hour: { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" },
  day: { day: "2-digit", month: "2-digit" },
};

const TITLE_FORMAT: Record<TimelineBucket, Intl.DateTimeFormatOptions> = {
  hour: { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" },
  day: { weekday: "short", day: "2-digit", month: "short", year: "numeric" },
};

export function timelineFormatters(bucket: TimelineBucket, locale: string, timeZone?: string) {
  const tick = new Intl.DateTimeFormat(locale, { ...TICK_FORMAT[bucket], timeZone });
  const title = new Intl.DateTimeFormat(locale, { ...TITLE_FORMAT[bucket], timeZone });
  return { tick: (iso: string) => tick.format(new Date(iso)), title: (iso: string) => title.format(new Date(iso)) };
}

export function hasTimelineActivity(points: readonly { sent: number; delivered: number; opens: number; clicks: number; bounces: number }[]): boolean {
  return points.some((point) => point.sent + point.delivered + point.opens + point.clicks + point.bounces > 0);
}

export function decideAt(startedAt: string | undefined, decideAfterMinutes: number): Date | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return null;
  return new Date(start + decideAfterMinutes * 60_000);
}

export function remainingSeconds(target: Date | null, now: number): number | null {
  if (!target) return null;
  return Math.max(0, Math.round((target.getTime() - now) / 1000));
}

export function splitDuration(seconds: number): { hours: number; minutes: number; seconds: number } {
  const whole = Math.max(0, Math.floor(seconds));
  return { hours: Math.floor(whole / 3600), minutes: Math.floor((whole % 3600) / 60), seconds: whole % 60 };
}

export function linkLabel(url: string): { host: string; path: string } {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith(TRACKING_PARAM_PREFIX)) parsed.searchParams.delete(key);
    }
    const path = `${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}`;
    return { host: parsed.host, path };
  } catch {
    return { host: url, path: "" };
  }
}
