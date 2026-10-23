"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { PaperPlaneTilt } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useEmailCampaignReview } from "@/hooks/use-email-campaigns";

import { useLaunchCost } from "./wizard/launch-cost";

export function StartCampaignDialog({ campaignId, onClose, onStart }: { campaignId: string | null; onClose: () => void; onStart: (campaignId: string) => Promise<unknown> }) {
  const t = useTranslations("emailCampaigns");
  const [openedAt, setOpenedAt] = useState("");
  useEffect(() => {
    if (campaignId) setOpenedAt(new Date().toISOString());
  }, [campaignId]);
  const review = useEmailCampaignReview(campaignId ?? "", campaignId !== null && openedAt !== "", `start|${openedAt}`);
  const cost = useLaunchCost(review.data);
  return (
    <ConfirmDialog
      open={campaignId !== null}
      onOpenChange={(open) => (open ? undefined : onClose())}
      tone="default"
      icon={<PaperPlaneTilt size={28} />}
      title={t("send.confirm.nowTitle")}
      description={review.data ? t("send.confirm.nowBody", { total: cost.total, count: cost.count, unit: cost.unit, first: cost.first }) : t("commands.start.loading")}
      confirmLabel={t("commands.start.action")}
      confirmDisabled={!review.data}
      onConfirm={async () => {
        if (campaignId) await onStart(campaignId);
        onClose();
      }}
    >
      {review.data ? <p className="rounded-[--radius] bg-muted px-3 py-2 text-center text-xs leading-relaxed text-muted-foreground">{t("send.confirm.batches", { size: cost.batch })}</p> : null}
    </ConfirmDialog>
  );
}
