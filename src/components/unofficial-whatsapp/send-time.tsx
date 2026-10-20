"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { sendTimeParts } from "@/lib/unofficial-whatsapp-campaigns/send-estimate";

export function useSendTimeLabel(): (seconds: number) => string {
  const t = useTranslations("unofficialWhatsappCampaigns.sendTime");
  return useCallback(
    (seconds: number) => {
      const parts = sendTimeParts(seconds);
      if (parts.key === "underMinute") return t("underMinute");
      if (parts.key === "minutes") return t("minutes", { minutes: parts.minutes });
      return t("hours", { hours: parts.hours, minutes: parts.minutes });
    },
    [t],
  );
}
