"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

import { compactAge } from "@/lib/crm/compact-age";
import { WAITING_ALERT_MINUTES } from "@/lib/conversations/waiting";

export interface InboxTimeText {
  waiting: (sinceIso: string, now: number) => string;
  waitingAlert: string;
}

export function useInboxTimeText(): InboxTimeText {
  const t = useTranslations("crmInbox");
  const locale = useLocale();
  return useMemo(() => {
    const shortDate = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" });
    return {
      waiting: (sinceIso, now) => {
        const age = compactAge(sinceIso, now);
        if (!age || age.unit === "now") return t("waiting.now");
        if (age.unit === "date") return t("waiting.date", { date: shortDate.format(age.date) });
        return t(`waiting.${age.unit}`, { value: age.value });
      },
      waitingAlert: t("waiting.alert", { minutes: WAITING_ALERT_MINUTES }),
    };
  }, [locale, t]);
}
