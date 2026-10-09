"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { dealActorName } from "@/lib/crm/opportunities";

const NO_DIRECTORY: ReadonlyMap<string, string> = new Map();

export function useLeadOwnerName(names: ReadonlyMap<string, string>, directoryReadable: boolean) {
  const t = useTranslations("leadsPage.owner");
  return useCallback(
    (ownerId: string | undefined, sentName?: string) => {
      const sent = sentName?.trim() || undefined;
      return dealActorName(ownerId, sent ? NO_DIRECTORY : names, {
        ai: t("ai"),
        workflow: t("workflow"),
        system: t("system"),
        unknownMember: directoryReadable ? t("removed") : t("member"),
      }, sent);
    },
    [names, directoryReadable, t],
  );
}
