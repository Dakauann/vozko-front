"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { DealActorLabels } from "@/lib/crm/opportunities";

export const NO_DEAL_MEMBERS: ReadonlyMap<string, string> = new Map();

export function useDealActorLabels(): DealActorLabels {
  const t = useTranslations("dealActors");
  return useMemo(
    () => ({ ai: t("ai"), workflow: t("workflow"), system: t("system"), unknownMember: t("unknownMember") }),
    [t],
  );
}
