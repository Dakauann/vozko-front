"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

export function useChannelName(): (channel: string | null | undefined) => string | null {
  const t = useTranslations("channelNames");
  return useCallback((channel) => (channel && t.has(channel) ? t(channel) : null), [t]);
}
