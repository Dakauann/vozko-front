"use client";

import { useTranslations } from "next-intl";

import { SendStep as CampaignSendStep } from "@/components/campaign-wizard/SendStep";
import Button from "@/components/elevated-design/button";
import { Notice } from "@/components/ui/notice";
import type { Campaign, LaunchIssue, Review, Sender } from "@/lib/email-campaigns/types";

import { useEmailFormat } from "../shared";
import { useLaunchCost } from "./launch-cost";
import { issueValues, type Money } from "./ReviewPanels";

export function SendStep({
  campaign,
  review,
  sender,
  money,
  canLaunch,
  canSchedule,
  canReady,
  canUnschedule,
  startAllowed,
  launching,
  launchIssues,
  onLaunch,
  onReady,
  onUnschedule,
}: {
  campaign: Campaign;
  review: Review | undefined;
  sender: Sender | undefined;
  money: Money;
  canLaunch: boolean;
  canSchedule: boolean;
  canReady: boolean;
  canUnschedule: boolean;
  startAllowed: boolean;
  launching: boolean;
  launchIssues: LaunchIssue[];
  onLaunch: (scheduledAt: string | null) => Promise<boolean>;
  onReady: () => Promise<boolean>;
  onUnschedule: () => void;
}) {
  const t = useTranslations("emailCampaigns.send");
  const tShared = useTranslations("campaignWizard.send");
  const tCheck = useTranslations("emailCampaigns.review.check");
  const { number, dateTime } = useEmailFormat();
  const zone = campaign.time_zone;
  const scheduled = campaign.status === "scheduled";
  const recipients = review ? review.audience.sendable : 0;
  const { total, unit, first, count, batch } = useLaunchCost(review);
  const subjects = campaign.ab_test ? `${campaign.subject} / ${campaign.ab_test.variant_b_subject}` : campaign.subject;

  const summary = [
    { label: t("summary.campaign"), value: campaign.name },
    { label: t("summary.sender"), value: sender ? (sender.display_name ? `${sender.display_name} <${sender.address}>` : sender.address) : t("summary.defaultSender") },
    { label: t("summary.subject"), value: subjects || t("summary.noSubject") },
    { label: t("summary.recipients"), value: review ? t("summary.recipientsValue", { count: number(recipients) }) : "…" },
    { label: t("summary.cost"), value: review ? t("summary.costValue", { total, units: count, unit }) : "…" },
  ];

  return (
    <CampaignSendStep
      timeZone={zone}
      scheduledAt={campaign.scheduled_at ?? null}
      scheduled={scheduled}
      blocking={review ? review.check.blocking.length : null}
      can={{ now: canLaunch, schedule: canSchedule, ready: canReady }}
      startAllowed={startAllowed}
      launching={launching}
      refused={launchIssues.map((issue) => ({ key: issue.code, text: tCheck(`issues.${issue.code}.title`, issueValues(issue, money)) }))}
      summary={summary}
      notice={
        scheduled && campaign.scheduled_at ? (
          <Notice tone="info" title={t("scheduledNotice.title", { date: dateTime(campaign.scheduled_at, zone) })}>
            <p>{t("scheduledNotice.body")}</p>
            {canUnschedule ? <Button variant="secondary" size="sm" title={tShared("unschedule")} onClick={onUnschedule} /> : null}
          </Notice>
        ) : null
      }
      confirm={{
        now: { title: t("confirm.nowTitle"), body: t("confirm.nowBody", { total, count, unit, first }) },
        schedule: (scheduledIso) => ({ title: t("confirm.scheduleTitle"), body: t("confirm.scheduleBody", { total, first, date: scheduledIso ? dateTime(scheduledIso, zone) : "" }) }),
        note: <p className="rounded-[--radius] bg-muted px-3 py-2 text-center text-xs leading-relaxed text-muted-foreground">{t("confirm.batches", { size: batch })}</p>,
      }}
      onLaunch={onLaunch}
      onReady={onReady}
    />
  );
}
