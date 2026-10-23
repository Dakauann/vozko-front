"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { transitionCarrierCampaignAction, type CampaignTransition } from "@/app/actions/carrier-messaging";
import Button from "@/components/elevated-design/button";
import { Copy, Pause, PencilSimple, Play, StopCircle } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { CodedRefusal } from "@/lib/api/coded-error";
import type { Campaign } from "@/lib/carrier-messaging/campaigns";

export function CampaignActions({
  campaign,
  onChanged,
  onDuplicated,
  onEdit,
  onRefusal,
}: {
  campaign: Campaign;
  onChanged: (campaign: Campaign) => void;
  onDuplicated?: (campaign: Campaign) => void;
  onEdit?: (campaign: Campaign) => void;
  onRefusal: (refusal: CodedRefusal | null) => void;
}) {
  const t = useTranslations("carrierMessaging.pages.campaignDetail.actions");
  const [busy, setBusy] = useState<CampaignTransition | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

  const run = async (transition: CampaignTransition) => {
    setBusy(transition);
    onRefusal(null);
    const answer = await transitionCarrierCampaignAction(campaign.id, transition);
    setBusy(null);
    if (answer.error) {
      onRefusal(answer.error);
      return false;
    }
    if (transition === "duplicate") onDuplicated?.(answer.data);
    else onChanged(answer.data);
    return true;
  };

  const editable = campaign.status === "draft" || campaign.status === "ready" || campaign.status === "scheduled";
  const stoppable = campaign.status === "running" || campaign.status === "paused" || campaign.status === "scheduled";

  return (
    <>
      {editable && onEdit ? (
        <Button variant="secondary" size="sm" title={t("edit")} icon={<PencilSimple className="h-3.5 w-3.5" />} iconVisible onClick={() => onEdit(campaign)} />
      ) : null}
      {campaign.status === "ready" ? (
        <Button variant="primary" size="sm" title={busy === "launch" ? t("starting") : t("start")} icon={<Play className="h-3.5 w-3.5" />} iconVisible disabled={busy !== null} onClick={() => void run("launch")} />
      ) : null}
      {campaign.status === "running" ? (
        <Button variant="secondary" size="sm" title={busy === "pause" ? t("pausing") : t("pause")} icon={<Pause className="h-3.5 w-3.5" />} iconVisible disabled={busy !== null} onClick={() => void run("pause")} />
      ) : null}
      {campaign.status === "paused" ? (
        <Button variant="primary" size="sm" title={busy === "resume" ? t("resuming") : t("resume")} icon={<Play className="h-3.5 w-3.5" />} iconVisible disabled={busy !== null} onClick={() => void run("resume")} />
      ) : null}
      {stoppable ? (
        <Button variant="ghost" size="sm" title={t("stop")} icon={<StopCircle className="h-3.5 w-3.5" />} iconVisible disabled={busy !== null} onClick={() => setConfirmStop(true)} />
      ) : null}
      <Button variant="ghost" size="sm" title={busy === "duplicate" ? t("duplicating") : t("duplicate")} icon={<Copy className="h-3.5 w-3.5" />} iconVisible disabled={busy !== null} onClick={() => void run("duplicate")} />
      <ConfirmDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title={t("stopTitle")}
        description={t("stopDescription")}
        confirmLabel={t("stopConfirm")}
        onConfirm={() => run("stop")}
      />
    </>
  );
}
