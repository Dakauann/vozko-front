"use client";

import { useTranslations } from "next-intl";

import type { DialBlocker } from "@/lib/dialer/dial-targets";

export function useDialBlockerReason(blocker: DialBlocker | null): string | null {
  const t = useTranslations("calling.dialTargets.reasons");
  return blocker ? t(blocker) : null;
}
