"use client";

import { useFormatter, useTranslations } from "next-intl";

import { instantOf } from "@/lib/leads/detail";
import { LEAD_OPT_OUT_SOURCES } from "@/lib/leads/types";

export function useOptOutLine(optedOutAt: string | null | undefined, optOutSource: string | undefined): string | null {
  const t = useTranslations("leadDetail.consent");
  const format = useFormatter();
  const at = instantOf(optedOutAt);
  if (!at) return null;
  const source = LEAD_OPT_OUT_SOURCES.find((candidate) => candidate === optOutSource);
  const date = format.dateTime(at, { dateStyle: "short" });
  return source ? t(`optedOutBy.${source}`, { date }) : t("optedOutDetail", { date });
}
