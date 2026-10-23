"use client";

import { useCallback } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import type { CampaignRecurrence } from "@/lib/carrier-messaging/campaigns";

const SUNDAY_UTC = Date.UTC(2024, 0, 7);
const DAY_MS = 24 * 60 * 60 * 1000;

export function weekdayName(locale: string, weekday: number, width: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" }).format(new Date(SUNDAY_UTC + weekday * DAY_MS));
}

function localDate(day: string): Date | null {
  const date = new Date(`${day}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function useScheduleSummary() {
  const t = useTranslations("carrierMessaging.schedule");
  const format = useFormatter();
  const locale = useLocale();
  return useCallback(
    (schedule: { scheduled_at: string | null; recurrence: CampaignRecurrence | null }): string | null => {
      const recurrence = schedule.recurrence;
      if (recurrence) {
        const base =
          recurrence.frequency === "daily"
            ? t("daily", { time: recurrence.time })
            : recurrence.frequency === "weekly"
              ? t("weekly", { days: format.list((recurrence.weekdays ?? []).map((day) => weekdayName(locale, day)), { type: "conjunction" }), time: recurrence.time })
              : t("monthly", { day: recurrence.day_of_month ?? 1, time: recurrence.time });
        const until = recurrence.until ? localDate(recurrence.until) : null;
        return until ? t("until", { schedule: base, date: format.dateTime(until, { dateStyle: "medium" }) }) : base;
      }
      if (schedule.scheduled_at) {
        const at = new Date(schedule.scheduled_at);
        if (!Number.isNaN(at.getTime())) return t("once", { date: format.dateTime(at, { dateStyle: "medium", timeStyle: "short" }) });
      }
      return null;
    },
    [t, format, locale],
  );
}
