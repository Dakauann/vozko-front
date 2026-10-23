"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { TypedCountConfirm } from "@/components/leads/bulk/PreviewStateBox";
import { Notice } from "@/components/ui/notice";
import { audienceNeedsConfirmation, confirmationOf, type AudienceConfirmation, type CampaignEstimate } from "@/lib/carrier-messaging/campaigns";
import type { LeadSelection } from "@/lib/leads/actions";
import { typedCountMatches } from "@/lib/leads/bulk-selection";

export function AudienceConfirm({
  audience,
  estimate,
  confirmed,
  onConfirm,
}: {
  audience: LeadSelection | null;
  estimate: Pick<CampaignEstimate, "recipients" | "audience_fingerprint">;
  confirmed: AudienceConfirmation | null;
  onConfirm: (confirmation: AudienceConfirmation | null) => void;
}) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor.review.audienceConfirm");
  const tBulk = useTranslations("leadsPage.bulk");
  const [typed, setTyped] = useState("");
  const candidate = confirmationOf(estimate);
  if (!audience || !audienceNeedsConfirmation(audience) || !candidate) return null;
  const previous = audience.expectedCount;
  const changed = previous !== undefined && previous !== candidate.count;
  const drift = changed ? (
    <p role="status" className="text-sm font-medium text-foreground">
      {tBulk("dialog.changed", { previous, count: candidate.count })}
    </p>
  ) : null;

  if (audience.mode === "everyone") {
    return (
      <div className="space-y-3 rounded-[--radius] border border-border bg-card p-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{t("everyoneTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("everyoneHint")}</p>
        </div>
        {drift}
        <TypedCountConfirm
          count={candidate.count}
          value={typed}
          onChange={(value) => {
            setTyped(value);
            onConfirm(typedCountMatches(value, candidate.count) ? candidate : null);
          }}
        />
      </div>
    );
  }

  const accepted = confirmed?.count === candidate.count && confirmed.fingerprint === candidate.fingerprint;
  return (
    <Notice tone={changed ? "warning" : "info"} title={changed ? t("changedTitle") : t("filteredTitle")}>
      {drift ?? <p>{t("filteredHint", { count: candidate.count })}</p>}
      {accepted ? (
        <p className="font-medium text-foreground">{t("confirmed", { count: candidate.count })}</p>
      ) : (
        <Button variant="outline" size="sm" title={t("confirm", { count: candidate.count })} onClick={() => onConfirm(candidate)} />
      )}
    </Notice>
  );
}
