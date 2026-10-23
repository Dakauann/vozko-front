"use client";

import { useTranslations } from "next-intl";

import { StatusChip } from "@/components/elevated-design/status-chip";
import { phoneQuality, phoneQualityTone, phoneStatusTone } from "@/lib/whatsapp-business-phones/health";

export function PhoneStatusChip({ status }: { status: string }) {
  const t = useTranslations("whatsappBusinessPhones.status");
  return <StatusChip tone={phoneStatusTone(status)} label={t.has(status) ? t(status) : status} />;
}

export function PhoneQualityChip({ rating }: { rating: string | undefined }) {
  const t = useTranslations("whatsappBusinessPhones.qualityRating");
  return <StatusChip tone={phoneQualityTone(rating)} label={t(phoneQuality(rating))} />;
}
