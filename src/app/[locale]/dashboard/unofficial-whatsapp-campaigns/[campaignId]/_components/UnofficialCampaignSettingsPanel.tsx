"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import { CalendarCheck, ChartBar, ChatCircle, Clock, PencilSimple, Robot, Timer, UsersThree, WhatsappLogo } from "@/components/icons";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { DetailRow, DetailRows } from "@/components/leads/detail/DetailRow";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { useSendTimeLabel } from "@/components/unofficial-whatsapp/send-time";
import { selectionSendControls } from "@/lib/campaigns/selection-send";
import { remainingToShow } from "@/lib/unofficial-whatsapp-campaigns/send-estimate";
import type { UnofficialWhatsAppCampaign } from "@/lib/unofficial-whatsapp-campaigns/types";

export function UnofficialCampaignSettingsPanel({
  campaign,
  canEdit,
  className,
}: {
  campaign: UnofficialWhatsAppCampaign;
  canEdit: boolean;
  className?: string;
}) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const ts = useTranslations("unofficialWhatsappCampaigns.detail.settings");
  const format = useFormatter();
  const sendTime = useSendTimeLabel();
  const sendsToGroups = campaign.audience === "groups";
  const senderPerGroup = sendsToGroups && !campaign.instanceId;
  const remaining = remainingToShow(campaign);
  const fromLeads = selectionSendControls(campaign.source, campaign.status).fromLeads;
  const automation = [campaign.enableAgentResponses ? t("detail.agentOn") : null, campaign.enableWorkflow ? t("detail.workflowOn") : null].filter(
    (value): value is string => value !== null,
  );

  return (
    <PanelSection
      boxed
      className={className}
      title={ts("title")}
      legend={fromLeads ? ts("fromLeads") : sendsToGroups ? t("detail.groupsAudience") : ts("people")}
      actions={
        canEdit ? (
          <Link
            href={`/dashboard/unofficial-whatsapp-campaigns/${campaign.id}/edit`}
            className="inline-flex h-7 items-center gap-1.5 rounded-[--radius] px-2 text-xs font-semibold text-foreground hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PencilSimple className="h-3.5 w-3.5" weight="bold" aria-hidden />
            {t("actions.edit")}
          </Link>
        ) : null
      }
    >
      <DetailRows>
        <DetailRow icon={<WhatsappLogo />} label={t("detail.number")} hint={senderPerGroup ? t("detail.senderPerGroup") : undefined}>
          {senderPerGroup ? ts("perGroup") : campaign.instanceLabel || <EmptyValue />}
        </DetailRow>
        <DetailRow
          icon={<ChatCircle />}
          label={t("detail.messageKind")}
          hint={campaign.message.bodies.length > 1 ? t("detail.variants", { count: campaign.message.bodies.length }) : undefined}
        >
          {t(`messageKind.${campaign.message.kind}`)}
        </DetailRow>
        <DetailRow icon={sendsToGroups ? <UsersThree /> : <Robot />} label={ts("automation")}>
          {automation.length > 0 ? automation.join(", ") : <span className="font-normal text-muted-foreground">{ts("noAutomation")}</span>}
        </DetailRow>
        <DetailRow icon={<Timer />} label={ts("pacing")}>
          {ts("pacingValue", {
            min: format.number(campaign.sendDelayMinMs / 1000, { maximumFractionDigits: 1 }),
            max: format.number(campaign.sendDelayMaxMs / 1000, { maximumFractionDigits: 1 }),
          })}
        </DetailRow>
        <DetailRow icon={<ChartBar />} label={ts("dailyCap")}>
          {campaign.dailyCap > 0 ? format.number(campaign.dailyCap) : <span className="font-normal text-muted-foreground">{ts("noCap")}</span>}
        </DetailRow>
        <DetailRow
          icon={<Clock />}
          label={ts("remaining")}
          hint={remaining && remaining.senders > 1 ? t("detail.remainingSenders", { count: remaining.senders }) : undefined}
        >
          {remaining ? sendTime(remaining.seconds) : <EmptyValue />}
        </DetailRow>
        <DetailRow icon={<CalendarCheck />} label={ts("created")}>
          {campaign.createdAt
            ? format.dateTime(new Date(campaign.createdAt), { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
            : <EmptyValue />}
        </DetailRow>
      </DetailRows>
    </PanelSection>
  );
}
