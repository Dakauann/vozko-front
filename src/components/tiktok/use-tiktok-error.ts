"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { tiktokErrorKey } from "@/lib/tiktok/errors";

export function useTiktokError() {
  const t = useTranslations("tiktok");
  return useCallback((failure: { status?: number }) => t(tiktokErrorKey(failure.status)), [t]);
}
