"use client";

import { useCallback, useMemo } from "react";
import { useFormatter, useTranslations, type DateTimeFormatOptions } from "next-intl";

import { useEmptyValue } from "@/components/elevated-design/empty-value";
import type { MembershipWindow } from "@/lib/unofficial-whatsapp-groups/types";

import { calendarDate, lastEventBucket, parseInstant, runDuration, shareOf } from "./format";

export function useGroupsFormat(timeZone?: string) {
  const format = useFormatter();
  const t = useTranslations("unofficialGroups.kit.format");
  const empty = useEmptyValue();

  return useMemo(() => {
    const zone = timeZone ? { timeZone } : {};
    const num = (n: number) => format.number(n);
    const pct = (value: number, digits = 1) => format.number(value / 100, { style: "percent", maximumFractionDigits: digits });
    const date = (at: string) => {
      const instant = parseInstant(at);
      return instant ? format.dateTime(instant, { day: "2-digit", month: "short", year: "numeric", ...zone }) : empty;
    };
    const calendar = (calendarDay: string, options: DateTimeFormatOptions) => {
      const day = calendarDate(calendarDay);
      return day ? format.dateTime(day, { ...options, timeZone: "UTC" }) : calendarDay;
    };
    return {
      num,
      compact: (n: number) => format.number(n, { notation: "compact", maximumFractionDigits: 1 }),
      signed: (n: number) => format.number(n, { signDisplay: "exceptZero" }),
      pct,
      signedPct: (value: number) => format.number(value / 100, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }),
      share: (part: number, total: number) => {
        const value = shareOf(part, total);
        return value === null ? empty : pct(value, 0);
      },
      day: (calendarDay: string) => calendar(calendarDay, { day: "2-digit", month: "short" }),
      dayLong: (calendarDay: string) => calendar(calendarDay, { weekday: "long", day: "numeric", month: "long" }),
      date,
      dateTime: (at: string) => {
        const instant = parseInstant(at);
        return instant
          ? format.dateTime(instant, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", ...zone })
          : empty;
      },
      time: (at: string) => {
        const instant = parseInstant(at);
        return instant ? format.dateTime(instant, { hour: "2-digit", minute: "2-digit", ...zone }) : empty;
      },
      relative: (at: string, now?: Date) => {
        const instant = parseInstant(at);
        if (!instant) return empty;
        return now ? format.relativeTime(instant, now) : format.relativeTime(instant);
      },
      lastEvent: (at?: string, now: Date = new Date()) => {
        const bucket = lastEventBucket(at, now, timeZone);
        switch (bucket.kind) {
          case "today":
            return t("lastEvent.today");
          case "yesterday":
            return t("lastEvent.yesterday");
          case "days":
            return t("lastEvent.days", { count: bucket.count ?? 0 });
          case "months":
            return t("lastEvent.months", { count: bucket.count ?? 1 });
          case "date":
            return date(at as string);
          default:
            return t("lastEvent.none");
        }
      },
      duration: (startedAt: string, completedAt?: string) => {
        const value = runDuration(startedAt, completedAt);
        if (!value) return empty;
        if (value.unit === "ms") return t("duration.ms", { value: num(value.value) });
        if (value.unit === "s") return t("duration.s", { value: format.number(value.value, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) });
        if (!value.seconds) return t("duration.min", { minutes: num(value.value) });
        return t("duration.minSeconds", { minutes: num(value.value), seconds: num(value.seconds) });
      },
      windowRange: (window: MembershipWindow) => {
        const options = { day: "2-digit", month: "short", timeZone: window.timezone || timeZone } as const;
        const from = parseInstant(window.from);
        const to = parseInstant(window.to);
        if (!from || !to) return empty;
        return t("windowRange", { from: format.dateTime(from, options), to: format.dateTime(to, options) });
      },
      minutes: (n: number) => t("minutes", { value: format.number(n, { maximumFractionDigits: 1 }) }),
    };
  }, [format, t, empty, timeZone]);
}

export type GroupsFormat = ReturnType<typeof useGroupsFormat>;

export function useGroupName() {
  const t = useTranslations("unofficialGroups.kit");
  return useCallback((subject: string | undefined) => subject?.trim() || t("untitledGroup"), [t]);
}
