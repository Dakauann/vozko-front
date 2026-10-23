"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { getCarrierCampaignAction } from "@/app/actions/carrier-messaging";
import { ChartSkeleton } from "@/components/dashboard/attendance/primitives";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Megaphone } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import type { CodedRefusal } from "@/lib/api/coded-error";
import type { Campaign } from "@/lib/carrier-messaging/campaigns";
import { useCarrierRefusalText } from "@/components/carrier-messaging/shared/use-carrier-error-text";

import { CarrierCampaignStatusChip, CarrierChannelChip } from "../../shared/CarrierLabels";
import { CARRIER_QUERY_OPTIONS, answerOrThrow, useCarrierWorkspaceId } from "../overview/carrier-query";
import { CampaignActions } from "./CampaignActions";
import { useScheduleText } from "./detail-format";
import { ButtonStatsPanel, CarriersPanel, LiveFunnelPanel, TimelinePanel, VariantsPanel } from "./panels";
import { RecipientsPanel } from "./RecipientsPanel";
import { CarrierAreaGate } from "@/components/carrier-messaging/shared/ComingSoon";

const STATUS_REFRESH_MS = 15_000;

function DetailBody({
  campaign,
  onBack,
  onEdit,
  onDuplicated,
}: {
  campaign: Campaign;
  onBack?: () => void;
  onEdit?: (campaign: Campaign) => void;
  onDuplicated?: (campaign: Campaign) => void;
}) {
  const t = useTranslations("carrierMessaging.pages.campaignDetail");
  const tKinds = useTranslations("carrierMessaging.campaignKinds");
  const client = useQueryClient();
  const workspaceId = useCarrierWorkspaceId();
  const refusalText = useCarrierRefusalText();
  const schedule = useScheduleText();
  const [refusal, setRefusal] = useState<CodedRefusal | null>(null);
  const live = campaign.status === "running";
  const launched = campaign.status !== "draft" && campaign.status !== "ready" && campaign.status !== "scheduled";

  const changed = (next: Campaign) => {
    client.setQueryData(["carrier-campaign", workspaceId, campaign.id], next);
    void client.invalidateQueries({ queryKey: ["carrier-campaign", workspaceId, campaign.id] });
  };

  return (
    <motion.main className="w-full space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <DashboardPageHeader
        icon={<Megaphone className="h-6 w-6" weight="fill" />}
        badge={t("header.badge")}
        title={campaign.name.trim() || t("header.untitled")}
        description={schedule(campaign.scheduled_at, campaign.recurrence)}
        back={onBack ? { onClick: onBack, label: t("header.back") } : undefined}
        meta={
          <>
            <CarrierCampaignStatusChip status={campaign.status} />
            <CarrierChannelChip channel={campaign.channel} />
            <span className="text-xs text-muted-foreground">{tKinds(campaign.kind)}</span>
            {campaign.variants.length > 1 ? <span className="text-xs text-muted-foreground">{t("header.abTest", { count: campaign.variants.length })}</span> : null}
          </>
        }
        actions={<CampaignActions campaign={campaign} onChanged={changed} onDuplicated={onDuplicated} onEdit={onEdit} onRefusal={setRefusal} />}
      />

      {refusal ? (
        <Notice tone="fault" title={t("actions.refusedTitle")}>
          <p>{refusalText(refusal)}</p>
        </Notice>
      ) : null}

      {launched ? (
        <>
          <LiveFunnelPanel campaign={campaign} live={live} />
          <TimelinePanel campaign={campaign} live={live} />
          <div className="grid gap-6 xl:grid-cols-2">
            {campaign.channel === "rcs" ? <ButtonStatsPanel campaign={campaign} live={live} /> : null}
            <CarriersPanel campaign={campaign} live={live} />
          </div>
          {campaign.variants.length > 1 ? <VariantsPanel campaign={campaign} live={live} /> : null}
          <RecipientsPanel campaign={campaign} live={live} />
        </>
      ) : (
        <Notice tone="info" title={t("notLaunched.title")}>
          <p>
            {campaign.status === "scheduled"
              ? t("notLaunched.scheduled", { when: schedule(campaign.scheduled_at, campaign.recurrence) })
              : campaign.status === "ready"
                ? t("notLaunched.ready")
                : t("notLaunched.draft")}
          </p>
        </Notice>
      )}
    </motion.main>
  );
}

function CarrierCampaignDetailBody({
  campaignId,
  onBack,
  onEdit,
  onDuplicated,
}: {
  campaignId: string;
  onBack?: () => void;
  onEdit?: (campaign: Campaign) => void;
  onDuplicated?: (campaign: Campaign) => void;
}) {
  const workspaceId = useCarrierWorkspaceId();
  const query = useQuery({
    ...CARRIER_QUERY_OPTIONS,
    queryKey: ["carrier-campaign", workspaceId, campaignId],
    queryFn: async ({ signal }) => answerOrThrow(await getCarrierCampaignAction(campaignId, signal)),
    enabled: workspaceId !== "" && campaignId !== "",
    refetchInterval: (state) => (state.state.data?.status === "running" || state.state.data?.status === "scheduled" ? STATUS_REFRESH_MS : false),
  });
  return (
    <SectionState query={query}>
      {query.data ? <DetailBody campaign={query.data} onBack={onBack} onEdit={onEdit} onDuplicated={onDuplicated} /> : <ChartSkeleton height={360} />}
    </SectionState>
  );
}

export function CarrierCampaignDetail(props: Parameters<typeof CarrierCampaignDetailBody>[0]) {
  const t = useTranslations("carrierMessaging.pages.campaigns");
  return (
    <CarrierAreaGate badge={t("header.badge")} description={t("header.description")}>
      <CarrierCampaignDetailBody {...props} />
    </CarrierAreaGate>
  );
}
