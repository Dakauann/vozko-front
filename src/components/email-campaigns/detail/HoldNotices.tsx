"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Notice } from "@/components/ui/notice";
import { holdReasonOf } from "@/lib/email-campaigns/status";
import type { Campaign } from "@/lib/email-campaigns/types";

import { useEmailFormat } from "../shared";

export function HoldNotices({ campaign }: { campaign: Campaign }) {
  const t = useTranslations("emailCampaigns.detail.hold");
  const { dateTime, number } = useEmailFormat();
  const hold = campaign.status === "held" ? holdReasonOf(campaign.hold?.reason ?? campaign.hold_reason) : null;

  if (campaign.status === "scheduled" && campaign.scheduled_at) {
    return (
      <Notice tone="info" title={t("scheduled.title", { date: dateTime(campaign.scheduled_at, campaign.time_zone) })}>
        <p>{t("scheduled.body")}</p>
      </Notice>
    );
  }

  const testBatch = campaign.test_batch;
  if (campaign.status === "running" && testBatch?.state === "testing") {
    return (
      <Notice tone="info" title={testBatch.drained_at ? t("testing.waitingTitle") : t("testing.sendingTitle", { size: number(testBatch.size) })}>
        <p>{t("testing.body", { size: number(testBatch.size) })}</p>
      </Notice>
    );
  }

  if (campaign.status === "paused") {
    return (
      <Notice tone="warning" title={t("paused.title")}>
        <p>{t("paused.body")}</p>
      </Notice>
    );
  }

  if (!hold) return null;

  if (hold === "daily_cap") {
    const resumeAt = campaign.hold?.resume_at;
    return (
      <Notice tone="warning" title={t("daily_cap.title")}>
        <p>{t("daily_cap.body")}</p>
        {resumeAt ? <p className="text-foreground">{t("daily_cap.resumeAt", { date: dateTime(resumeAt, campaign.time_zone) })}</p> : null}
      </Notice>
    );
  }

  if (hold === "account_paused") {
    const reason = campaign.hold?.account_status_reason;
    return (
      <Notice tone="fault" title={t("account_paused.title")}>
        <p>{t("account_paused.body")}</p>
        {reason ? <p className="text-foreground">{t("account_paused.reason", { reason })}</p> : null}
        <Button variant="secondary" size="sm" title={t("goToSenders")} link="/dashboard/email/senders" newTab={false} />
      </Notice>
    );
  }

  if (hold === "balance_insufficient") {
    return (
      <Notice tone="warning" title={t("balance_insufficient.title")}>
        <p>{t("balance_insufficient.body", { size: number(campaign.billing.batch_size) })}</p>
        <Button variant="secondary" size="sm" title={t("balance_insufficient.topUp")} link="/dashboard/balance" newTab={false} />
      </Notice>
    );
  }

  if (hold === "test_batch_bounces" || hold === "test_batch_complaints") {
    return (
      <Notice tone="fault" title={t(`${hold}.title`)}>
        <p>{t(`${hold}.body`, { size: number(testBatch?.size ?? 0) })}</p>
        <p className="text-foreground">{t("testBatchStopOnly")}</p>
      </Notice>
    );
  }

  return (
    <Notice tone="fault" title={t(`${hold}.title`)}>
      <p>{t(`${hold}.body`)}</p>
      <Button variant="secondary" size="sm" title={t("goToSenders")} link="/dashboard/email/senders" newTab={false} />
    </Notice>
  );
}
