"use client";

import { useFormatter, useTranslations } from "next-intl";

import { SendStep, type SendMode, type SendRefusal, type SendSummaryRow } from "@/components/campaign-wizard/SendStep";
import { CarrierChannelChip } from "@/components/carrier-messaging/shared/CarrierLabels";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import type { CampaignDraft } from "@/lib/carrier-messaging/campaigns";

import { useScheduleSummary } from "../../shared/schedule-summary";
import { audienceCount, scheduleIncomplete, scheduleModeOf, withScheduleMode } from "./editor-state";
import { ScheduleExtra } from "./ScheduleExtra";

export function CarrierSendStep({
  draft,
  onChange,
  timezone,
  scheduled,
  mode,
  onModeChange,
  senderName,
  blocking,
  available,
  launching,
  refused,
  onLaunch,
  onReady,
}: {
  draft: CampaignDraft;
  onChange: (draft: CampaignDraft) => void;
  timezone: string;
  scheduled: boolean;
  mode: SendMode;
  onModeChange: (mode: SendMode) => void;
  senderName: string | null;
  blocking: number;
  available: boolean;
  launching: boolean;
  refused: readonly SendRefusal[];
  onLaunch: () => Promise<boolean>;
  onReady: () => Promise<boolean>;
}) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor");
  const format = useFormatter();
  const scheduleOf = useScheduleSummary();
  const count = audienceCount(draft.audience);
  const when = scheduleOf(draft);

  const summary: SendSummaryRow[] = [
    { label: t("review.rows.name"), value: draft.name.trim() || <EmptyValue /> },
    { label: t("review.rows.channel"), value: <CarrierChannelChip channel={draft.channel} /> },
    { label: t("review.rows.sender"), value: senderName ?? <EmptyValue /> },
    { label: t("review.rows.audience"), value: draft.audience ? (count === null ? t("review.audienceLater") : format.number(count)) : <EmptyValue /> },
    { label: t("review.rows.schedule"), value: mode === "now" ? t("review.sendNow") : mode === "ready" ? t("send.readyLater") : when ?? <EmptyValue /> },
  ];

  const choose = (next: SendMode) => {
    onModeChange(next);
    if (next === "schedule" && scheduleModeOf(draft) === "now") onChange(withScheduleMode(draft, "once", timezone));
  };

  return (
    <SendStep
      timeZone={timezone}
      scheduledAt={draft.scheduled_at}
      scheduled={scheduled}
      blocking={blocking}
      can={{ now: available, schedule: available, ready: available }}
      startAllowed
      launching={launching}
      refused={refused}
      summary={summary}
      confirm={{
        now: { title: t("send.nowTitle"), body: t("send.nowBody") },
        schedule: () => ({ title: t("send.scheduleTitle"), body: t("send.scheduleBody", { when: when ?? "" }) }),
      }}
      hideScheduleInput
      scheduleIncomplete={scheduleIncomplete(draft)}
      scheduleExtra={<ScheduleExtra draft={draft} onChange={onChange} timezone={timezone} />}
      onModeChange={choose}
      onLaunch={onLaunch}
      onReady={onReady}
    />
  );
}
