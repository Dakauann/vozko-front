"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import {
  CalendarCheck,
  ChatCircle,
  Clock,
  ListDashes,
  PencilSimple,
  Robot,
  Sparkle,
  TreeStructure,
  WhatsappLogo,
} from "@/components/icons";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { DetailRow, DetailRows } from "@/components/leads/detail/DetailRow";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { selectionSendControls } from "@/lib/campaigns/selection-send";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";

export function CampaignSettingsPanel({
  campaign,
  templateName,
  agentName,
  canEdit,
  className,
}: {
  campaign: WhatsAppCampaign;
  templateName?: string;
  agentName?: string;
  canEdit: boolean;
  className?: string;
}) {
  const t = useTranslations("whatsappCampaignsPage.detail.settings");
  const format = useFormatter();
  const when = (value?: string | null) =>
    value ? format.dateTime(new Date(value), { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
  const tools = [
    campaign.enableAnalysis ? t("tools.analysis") : null,
    campaign.enableAutoStaging ? t("tools.staging") : null,
    campaign.enableAutoMemory ? t("tools.memory") : null,
  ].filter((tool): tool is string => tool !== null);
  const response = campaign.workflowId
    ? { icon: <TreeStructure />, value: t("response.workflow") }
    : campaign.enableAgentResponses && campaign.agentId
      ? { icon: <Robot />, value: agentName ?? t("response.unnamedAgent") }
      : { icon: <Robot />, value: null };
  const fromLeads = selectionSendControls(campaign.source, campaign.status).fromLeads;
  const scheduled = when(campaign.scheduledStart);
  const created = when(campaign.createdAt);

  return (
    <PanelSection
      boxed
      className={className}
      title={t("title")}
      legend={fromLeads ? t("fromLeads") : t("manual")}
      actions={
        canEdit ? (
          <Link
            href={`/dashboard/whatsapp-campaigns/${campaign.id}/edit`}
            aria-label={t("edit")}
            className="inline-flex h-7 items-center gap-1.5 rounded-[--radius] px-2 text-xs font-semibold text-foreground hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PencilSimple className="h-3.5 w-3.5" weight="bold" aria-hidden />
            {t("edit")}
          </Link>
        ) : null
      }
    >
      <DetailRows>
        <DetailRow icon={<ChatCircle />} label={t("template")}>
          {templateName || campaign.templateName || <EmptyValue />}
        </DetailRow>
        <DetailRow icon={<WhatsappLogo />} label={t("number")} mono={!campaign.businessPhone?.verifiedName}>
          {campaign.businessPhone ? campaign.businessPhone.verifiedName || campaign.businessPhone.displayPhoneNumber : <EmptyValue />}
        </DetailRow>
        <DetailRow icon={response.icon} label={t("response.label")}>
          {response.value ?? <span className="font-normal text-muted-foreground">{t("response.none")}</span>}
        </DetailRow>
        <DetailRow icon={<Sparkle />} label={t("tools.label")} hint={tools.length > 0 && campaign.aiModel ? campaign.aiModel : undefined}>
          {tools.length > 0 ? tools.join(", ") : <span className="font-normal text-muted-foreground">{t("tools.none")}</span>}
        </DetailRow>
        <DetailRow icon={<ListDashes />} label={t("crm")}>
          {campaign.showTemplateInCrm ? t("yes") : t("no")}
        </DetailRow>
        <DetailRow icon={<Clock />} label={t("schedule")}>
          {scheduled ?? <span className="font-normal text-muted-foreground">{t("noSchedule")}</span>}
        </DetailRow>
        <DetailRow icon={<CalendarCheck />} label={t("created")}>
          {created ?? <EmptyValue />}
        </DetailRow>
      </DetailRows>
    </PanelSection>
  );
}
