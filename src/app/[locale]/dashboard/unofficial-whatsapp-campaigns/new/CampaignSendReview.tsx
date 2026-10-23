"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { Notice } from "@/components/ui/notice";
import { useSendTimeLabel } from "@/components/unofficial-whatsapp/send-time";
import { blocksForGood } from "@/lib/unofficial-whatsapp-campaigns/group-audience";
import type { CampaignEstimateDraft, GroupSenderPlan } from "@/lib/unofficial-whatsapp-campaigns/types";

import { pickedInRunningCampaigns, type PickedCampaignGroup } from "./group-picks";

export function pickedPlan(groups: readonly GroupSenderPlan[] | undefined, picked: readonly PickedCampaignGroup[]): GroupSenderPlan[] {
  const jids = new Set(picked.map((group) => group.jid));
  return (groups ?? []).filter((group) => jids.has(group.jid));
}

export function unsendableGroups(groups: readonly GroupSenderPlan[]): number {
  return groups.filter((group) => blocksForGood(group.block)).length;
}

export function CampaignSendReview({
  isGroups,
  draft,
  failed,
  picked,
}: {
  isGroups: boolean;
  draft: CampaignEstimateDraft | null;
  failed: boolean;
  picked: readonly PickedCampaignGroup[];
}) {
  const t = useTranslations("unofficialWhatsappCampaigns.form");
  const sendTime = useSendTimeLabel();
  const locale = useLocale();
  const orList = useMemo(() => new Intl.ListFormat(locale, { type: "disjunction" }), [locale]);
  const runningById = useMemo(() => new Map(picked.map((group) => [group.jid, group.runningCampaigns])), [picked]);

  const plan = pickedPlan(draft?.groups, picked);
  const blocked = unsendableGroups(plan);
  const running = isGroups ? pickedInRunningCampaigns(picked) : 0;

  return (
    <ElevatedContainer className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-3 font-display text-xl font-semibold tracking-[0.01em] text-foreground">{t("review.title")}</h2>
      <div className="space-y-3">
        {draft ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{t("review.estimate", { time: sendTime(draft.estimate.seconds) })}</p>
            {isGroups && draft.estimate.senders > 1 ? <p className="text-xs text-muted-foreground">{t("review.parallel", { count: draft.estimate.senders })}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{failed ? t("review.failed") : t("review.loading")}</p>
        )}

        {isGroups && plan.length > 0 ? (
          <ul aria-label={t("review.groups")} className="divide-y divide-border rounded-[--radius] border border-border">
            {plan.map((group) => (
              <li key={group.jid} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2">
                <span className="min-w-0 truncate text-sm font-medium text-foreground">{group.name}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-2xs text-muted-foreground">
                  {(runningById.get(group.jid) ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                      {t("groups.running", { count: runningById.get(group.jid) ?? 0 })}
                    </span>
                  ) : null}
                  <span>{group.block ? t(`groups.block.${group.block}`) : t("groups.postsFrom", { numbers: orList.format(group.senders.map((sender) => sender.label)) })}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {blocked > 0 ? (
          <Notice tone="warning">
            <p>{t("review.unsendable", { count: blocked })}</p>
          </Notice>
        ) : null}
        {running > 0 ? (
          <Notice tone="warning">
            <p>{t("review.running", { count: running })}</p>
          </Notice>
        ) : null}
      </div>
    </ElevatedContainer>
  );
}
