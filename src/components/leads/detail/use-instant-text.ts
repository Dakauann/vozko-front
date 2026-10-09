"use client";

import { useFormatter, useNow, useTimeZone, useTranslations } from "next-intl";

import { relativeDayOf } from "@/lib/format/calendar-day";
import { instantOf } from "@/lib/leads/detail";

export function useInstantText() {
  const format = useFormatter();
  return (value: string | null | undefined) => {
    const date = instantOf(value);
    return date ? format.dateTime(date, { dateStyle: "medium", timeStyle: "short" }) : null;
  };
}

export function useRelativeInstantText() {
  const t = useTranslations("leadDetail.relativeInstant");
  const format = useFormatter();
  const now = useNow();
  const timeZone = useTimeZone();
  return (value: string | null | undefined) => {
    const date = instantOf(value);
    if (!date) return null;
    const time = () => format.dateTime(date, { hour: "2-digit", minute: "2-digit" });
    switch (relativeDayOf(date, now, timeZone)) {
      case "today":
        return t("today", { time: time() });
      case "yesterday":
        return t("yesterday", { time: time() });
      case "thisYear":
        return format.dateTime(date, { day: "2-digit", month: "2-digit" });
      case "older":
        return format.dateTime(date, { day: "2-digit", month: "2-digit", year: "numeric" });
    }
  };
}
