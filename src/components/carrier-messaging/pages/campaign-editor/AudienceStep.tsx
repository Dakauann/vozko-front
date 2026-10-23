"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import { estimateCarrierCampaignAction } from "@/app/actions/carrier-messaging";
import { CampaignAudienceStep } from "@/components/campaign-audience/CampaignAudienceStep";
import { answered } from "@/components/campaign-audience/use-audience-queries";
import { useCampaignAudience, type ExternalAudienceCount } from "@/components/campaign-audience/use-campaign-audience";
import Button from "@/components/elevated-design/button";
import { UsersThree } from "@/components/icons";
import { SelectionSummaryLine } from "@/components/leads/sends/SelectionSummaryLine";
import { useWorkspace } from "@/contexts/workspace-context";
import { codedQueryError } from "@/lib/api/coded-query-error";
import { leadsSelectionOf, type AudienceDraft } from "@/lib/campaign-audience/draft";
import type { CampaignKind } from "@/lib/carrier-messaging/campaigns";
import type { LeadSelection } from "@/lib/leads/actions";

import { audienceCount } from "./editor-state";

function initialDraftOf(audience: LeadSelection | null): Partial<AudienceDraft> {
  if (audience?.mode === "everyone") return { pick: "everyone", excludeIds: audience.excludeIds ?? [] };
  if (audience?.mode === "ids") return { pick: "ids", ids: audience.ids ?? [] };
  if (audience?.mode === "all_matching" && audience.filter) return { pick: "filter", filter: audience.filter, excludeIds: audience.excludeIds ?? [] };
  return {};
}

function sameAudience(a: LeadSelection | null, b: LeadSelection | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function useSavedCampaignCount(campaignId: string | null): ExternalAudienceCount | undefined {
  const { currentWorkspace } = useWorkspace();
  const query = useQuery({
    queryKey: ["carrier-estimate", currentWorkspace?.id ?? "", campaignId ?? ""],
    queryFn: async ({ signal }) => answered(await estimateCarrierCampaignAction(campaignId as string, signal)),
    enabled: campaignId !== null,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
  });
  if (campaignId === null) return undefined;
  return { data: query.data?.count ?? null, updatedAt: query.dataUpdatedAt, error: codedQueryError(query.error), pending: query.isFetching, reload: () => void query.refetch() };
}

function LeadsAudience({
  audience,
  kind,
  campaignId,
  onChange,
}: {
  audience: LeadSelection | null;
  kind: CampaignKind;
  campaignId: string | null;
  onChange: (audience: LeadSelection | null) => void;
}) {
  const [initial] = useState(() => initialDraftOf(audience));
  const fields = useMemo(() => ({ kind }), [kind]);
  const [changed, setChanged] = useState(false);
  const saved = useSavedCampaignCount(changed ? null : campaignId);
  const step = useCampaignAudience({ channel: "carrier", fields, initial, counted: saved });
  const [startDraft] = useState(step.draft);
  const touched = step.draft !== startDraft;
  if (touched && !changed) setChanged(true);
  const counted = step.recipients?.selection ?? null;
  const nextKey = JSON.stringify(counted ?? leadsSelectionOf(step.draft));
  const writes = touched || counted !== null;

  useEffect(() => {
    if (!writes) return;
    const next = JSON.parse(nextKey) as LeadSelection | null;
    if (!sameAudience(audience, next)) onChange(next);
  }, [writes, nextKey, audience, onChange]);

  return <CampaignAudienceStep audience={step} />;
}

function FirstNSummary({ audience, onStartOver }: { audience: LeadSelection; onStartOver: () => void }) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor.audience");
  const format = useFormatter();
  const count = audienceCount(audience);
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[--radius] border border-border bg-card px-4 py-4">
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[--radius] border border-control-edge bg-muted text-foreground">
        <UsersThree className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-display text-lg font-semibold tabular-nums text-foreground">
          {count === null ? t("countLater") : t("count", { count, formatted: format.number(count) })}
        </p>
        <p className="text-sm text-muted-foreground">{t("modes.first_n", { limit: audience.limit ?? 0 })}</p>
        {audience.filter ? <SelectionSummaryLine filter={audience.filter} /> : null}
      </div>
      <Button variant="outline" title={t("startOver")} onClick={onStartOver} />
    </div>
  );
}

export function AudienceStep({
  audience,
  kind,
  campaignId,
  onChange,
}: {
  audience: LeadSelection | null;
  kind: CampaignKind;
  campaignId: string | null;
  onChange: (audience: LeadSelection | null) => void;
}) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor.audience");
  const [restarted, setRestarted] = useState(false);
  const firstN = audience?.mode === "first_n" && !restarted;

  return (
    <div className="space-y-4">
      {firstN && audience ? (
        <FirstNSummary
          audience={audience}
          onStartOver={() => {
            setRestarted(true);
            onChange(null);
          }}
        />
      ) : (
        <LeadsAudience audience={restarted ? null : audience} kind={kind} campaignId={restarted ? null : campaignId} onChange={onChange} />
      )}
      <p className="text-xs text-muted-foreground">{t("frozenHint")}</p>
    </div>
  );
}
