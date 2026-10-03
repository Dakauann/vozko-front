"use client";

import { useTranslations } from "next-intl";

import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { draftTone, type DraftMark } from "@/lib/advertising/manager-drafts";

import { StatusDot } from "../status-dot";

export function DraftStatus({ draft }: { draft: DraftMark }) {
  const t = useTranslations("adsManager.drafts");
  const status = <StatusDot tone={draftTone(draft.state)}>{t(`state.${draft.state}`)}</StatusDot>;
  if (draft.state !== "failed") return status;
  return (
    <TooltipWrapper content={draft.error || t("failedNoReason")}>
      <span tabIndex={0} className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {status}
      </span>
    </TooltipWrapper>
  );
}
