"use client";

import { useTranslations } from "next-intl";

import { StatusChip } from "@/components/elevated-design/status-chip";

export function SmsSegmentsBadge({ segments }: { segments: number }) {
  const t = useTranslations("sms.thread");
  return <StatusChip tone="outline" label={t("segments", { count: segments })} className="mt-1.5 text-2xs" />;
}
