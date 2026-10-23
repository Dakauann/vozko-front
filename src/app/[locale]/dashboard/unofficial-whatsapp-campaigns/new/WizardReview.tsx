"use client";

import { useTranslations } from "next-intl";

import { PanelSection } from "@/components/dashboard/PanelSection";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { Notice } from "@/components/ui/notice";
import { LaunchFindings } from "@/components/whatsapp/launch-check/LaunchCheckDialog";
import type { UnofficialDraftReview } from "@/lib/campaign-drafts/types";
import type { LaunchReport } from "@/lib/whatsapp-campaigns/launch-check";

import { CampaignSendReview } from "./CampaignSendReview";
import type { PickedCampaignGroup } from "./group-picks";

const IGNORE = () => undefined;

export function blockingOf(review: UnofficialDraftReview | undefined): number | null {
  if (!review) return null;
  return review.check.findings.filter((finding) => finding.level === "block").length;
}

export function WizardReview({ review, isGroups, picked }: { review: UnofficialDraftReview; isGroups: boolean; picked: readonly PickedCampaignGroup[] }) {
  const t = useTranslations("unofficialWhatsappCampaigns.wizard.review");
  const sendable = review.audience?.sendable;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <PanelSection boxed title={t("audienceTitle")} description={isGroups ? t("audienceGroups") : t("audienceLeads")}>
        <p className="readout font-display text-2xl font-semibold text-foreground">
          {sendable === null || sendable === undefined ? <EmptyValue /> : isGroups ? t("groupsValue", { count: sendable }) : t("leadsValue", { count: sendable })}
        </p>
      </PanelSection>

      <CampaignSendReview isGroups={isGroups} draft={review.estimate} failed={review.estimate === null} picked={picked} />

      <PanelSection boxed title={t("checkTitle")} description={t("checkDescription")} className="xl:col-span-2">
        <div className="space-y-3">
          {review.check.findings.length === 0 ? (
            <Notice tone="healthy" title={t("ready")}>
              <p>{t("readyBody")}</p>
            </Notice>
          ) : (
            <LaunchFindings report={review.check as LaunchReport} links={{}} confirmed={false} onConfirmedChange={IGNORE} />
          )}
        </div>
      </PanelSection>
    </div>
  );
}
