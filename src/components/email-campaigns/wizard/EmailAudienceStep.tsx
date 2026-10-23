"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";

import { CampaignAudienceStep } from "@/components/campaign-audience/CampaignAudienceStep";
import { useCampaignAudience } from "@/components/campaign-audience/use-campaign-audience";
import { Notice } from "@/components/ui/notice";
import { keptChoices, type AudienceDraft, type LeadsPickDraft } from "@/lib/campaign-audience/draft";
import type { ChannelFields } from "@/lib/campaign-audience/types";
import type { Document } from "@/lib/email-design/types";

export function EmailAudienceStep({
  initial,
  subject,
  document,
  readOnly,
  onAudienceChange,
  onCounted,
  onEditMap,
}: {
  initial: AudienceDraft;
  subject: string;
  document: Document | null;
  readOnly: boolean;
  onAudienceChange: (audience: AudienceDraft) => void;
  onCounted: () => void;
  onEditMap?: (pick: LeadsPickDraft) => void;
}) {
  const t = useTranslations("emailCampaigns.audience");
  const fields = useMemo<ChannelFields>(() => (document ? { subject, document } : { subject }), [subject, document]);
  const audience = useCampaignAudience({ channel: "email", fields, initial });
  const { draft, count, counting } = audience;

  const saved = useMemo<AudienceDraft>(
    () => (count && !counting ? { ...draft, variables: keptChoices(draft.variables, count.variables) } : draft),
    [draft, count, counting],
  );

  useEffect(() => {
    onAudienceChange(saved);
  }, [saved, onAudienceChange]);

  const lastCounted = useRef(audience.countedAt);
  useEffect(() => {
    if (audience.countedAt === lastCounted.current) return;
    const first = lastCounted.current === 0;
    lastCounted.current = audience.countedAt;
    if (!first) onCounted();
  }, [audience.countedAt, onCounted]);

  return (
    <CampaignAudienceStep
      audience={audience}
      readOnly={readOnly}
      onEditMap={onEditMap}
      notice={
        <Notice tone="info">
          <p>{t("consent")}</p>
        </Notice>
      }
    />
  );
}
