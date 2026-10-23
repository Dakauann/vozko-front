"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import type { Campaign, CampaignRecurrence } from "@/lib/carrier-messaging/campaigns";

import { useScheduleSummary } from "../../shared/schedule-summary";

const LETTERS = ["A", "B", "C", "D"];

export function variantLabel(campaign: Pick<Campaign, "variants">, index: number, fallback: (letter: string) => string): string {
  const name = campaign.variants[index]?.name.trim();
  return name || fallback(LETTERS[index] ?? String(index + 1));
}

export function useScheduleText() {
  const t = useTranslations("carrierMessaging.pages.campaignDetail.schedule");
  const summary = useScheduleSummary();
  return useCallback(
    (scheduledAt: string | null, recurrence: CampaignRecurrence | null): string => summary({ scheduled_at: scheduledAt, recurrence }) ?? t("now"),
    [summary, t],
  );
}
