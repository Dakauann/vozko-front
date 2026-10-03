"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import type { MetaAdsConnectResult } from "@/lib/advertising/types";

export interface ConnectMessage {
  title: string;
  description: string;
  failed: boolean;
}

export function useConnectResultMessage() {
  const t = useTranslations("adsManager.connect");
  return useCallback(
    (result: MetaAdsConnectResult): ConnectMessage | null => {
      if (result.status === "cancelled") return null;
      if (result.status === "error") {
        const reason = `errors.${result.reason}`;
        return { title: t("errorTitle"), description: t.has(reason) ? t(reason) : t("errors.connect_failed"), failed: true };
      }
      return {
        title: result.status === "partial" ? t("partialTitle") : t("successTitle"),
        description: [result.count !== undefined ? t("count", { count: result.count }) : null, result.status === "partial" ? t("errors.linked_elsewhere") : null]
          .filter(Boolean)
          .join(" "),
        failed: false,
      };
    },
    [t],
  );
}
