"use client";

import { useFormatter, useTranslations } from "next-intl";

import { ElevatedStepFlow } from "@/components/elevated-design/elevated-step-flow";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { Notice } from "@/components/ui/notice";
import { SENDER_TRACK, senderStatusTone, senderTrackIndex } from "@/lib/rcs/sender-status";
import type { RcsSender } from "@/lib/rcs/types";

export type SenderTrackFacts = Pick<
  RcsSender,
  "status" | "status_reason" | "paused_by" | "pause_reason" | "submitted_at" | "launched_at" | "paused_at" | "contact_email"
>;

export function SenderStatusChip({ status }: { status: RcsSender["status"] }) {
  const t = useTranslations("rcs.senders.status");
  return <StatusChip tone={senderStatusTone(status)} label={t(status)} />;
}

function NowText({ sender }: { sender: SenderTrackFacts }) {
  const t = useTranslations("rcs.senders.track.now");
  const format = useFormatter();
  const when = (value: string | null) => (value ? format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" }) : null);
  switch (sender.status) {
    case "draft":
    case "rejected":
      return <p>{t(sender.status)}</p>;
    case "submitted":
      return <p>{when(sender.submitted_at) ? t("submittedAt", { date: when(sender.submitted_at)! }) : t("submitted")}</p>;
    case "awaiting_confirmation":
      return <p>{sender.contact_email ? t("awaitingEmail", { email: sender.contact_email }) : t("awaiting_confirmation")}</p>;
    case "launched":
      return <p>{when(sender.launched_at) ? t("launchedAt", { date: when(sender.launched_at)! }) : t("launched")}</p>;
    case "paused":
      return (
        <div className="space-y-1">
          <p>{sender.paused_by ? t(`pausedBy.${sender.paused_by}`) : t("paused")}</p>
          {sender.pause_reason ? <p className="text-muted-foreground">{t(`pauseReasons.${sender.pause_reason}`)}</p> : null}
          {sender.status_reason ? <p className="text-muted-foreground">{sender.status_reason}</p> : null}
        </div>
      );
  }
}

export function SenderStatusTrack({ sender, className }: { sender: SenderTrackFacts; className?: string }) {
  const t = useTranslations("rcs.senders");
  const current = senderTrackIndex(sender.status);
  const steps = SENDER_TRACK.map((step) => ({
    id: step,
    title: t(`status.${step}`),
    caption: t(`track.captions.${step}`),
  }));

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="legend">{t("track.title")}</p>
        <SenderStatusChip status={sender.status} />
      </div>
      {sender.status === "rejected" ? (
        <Notice tone="fault" title={t("track.rejectedTitle")} className="mb-3">
          <p>{sender.status_reason.trim() || t("track.rejectedFallback")}</p>
        </Notice>
      ) : null}
      <ElevatedStepFlow steps={steps} currentStep={current} editLabel={t("track.edit")}>
        <div className="text-sm leading-relaxed text-foreground">
          <NowText sender={sender} />
        </div>
      </ElevatedStepFlow>
    </div>
  );
}
