"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, Megaphone, WhatsappLogo, Phone } from "@/components/icons";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { LeadSendButton } from "@/components/leads/sends/LeadSendButton";
import type { CampaignHistoryItem, LeadDetail } from "@/lib/leads/types";
import { cn } from "@/lib/utils";

import { useInstantText } from "./use-instant-text";

function CampaignRow({ campaign }: { campaign: CampaignHistoryItem }) {
  const t = useTranslations("leadDetail.campaigns");
  const tStatus = useTranslations("leadsPage.filters.options.campaignStatus");
  const instantText = useInstantText();
  const [open, setOpen] = useState(false);
  const statusLabel = (status: string) => (tStatus.has(status) ? tStatus(status) : status);

  return (
    <li className="border-b border-border last:border-0">
      <button
        type="button"
        aria-expanded={open}
        title={open ? t("hideEntries") : t("showEntries")}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 py-2.5 text-left focus-visible:rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="inline-flex shrink-0 items-center gap-1 rounded-[--radius] bg-muted px-2 py-0.5 text-2xs font-medium text-foreground">
          {campaign.type === "whatsapp" ? <WhatsappLogo weight="fill" className="h-3 w-3 text-healthy-ink" aria-hidden /> : <Phone className="h-3 w-3" aria-hidden />}
          {t(`channels.${campaign.type}`)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{campaign.campaignName || campaign.campaignId}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t("entries", { count: campaign.entries.length })}</span>
        <CaretDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <table className="mb-3 w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-1.5 pr-3 text-left font-semibold">{t("status")}</th>
              <th className="px-3 py-1.5 text-left font-semibold">{t("date")}</th>
              <th className="py-1.5 pl-3 text-left font-semibold">{t("entry")}</th>
            </tr>
          </thead>
          <tbody>
            {campaign.entries.map((entry) => (
              <tr key={entry.id} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-3">
                  <span className="inline-block rounded-[--radius] bg-muted px-2 py-0.5 text-2xs font-medium text-foreground">{statusLabel(entry.status)}</span>
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">{instantText(entry.createdAt) ?? <EmptyValue />}</td>
                <td className="py-1.5 pl-3 font-mono text-muted-foreground" title={entry.id}>
                  {entry.id.slice(0, 8)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </li>
  );
}

export function LeadCampaignsTab({ lead }: { lead: LeadDetail }) {
  const t = useTranslations("leadDetail.campaigns");
  const tActions = useTranslations("leadDetail.actions");
  const instantText = useInstantText();
  const lastActivity = instantText(lead.lastActivityAt);

  return (
    <PanelSection
      title={t("title")}
      legend={lead.totalCampaigns > 0 ? t("entries", { count: lead.campaigns.reduce((sum, c) => sum + c.entries.length, 0) }) : undefined}
      description={lastActivity ? t("lastActivity", { date: lastActivity }) : undefined}
    >
      <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <WhatsappLogo weight="fill" className="h-3.5 w-3.5" aria-hidden />
        <span>{t("window")}</span>
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-2xs font-semibold",
            lead.whatsappWindowOpen ? "bg-healthy text-healthy-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {lead.whatsappWindowOpen ? t("windowOpen") : t("windowClosed")}
        </span>
      </p>
      {lead.campaigns.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Megaphone className="h-4 w-4" aria-hidden />
            {t("empty")}
          </p>
          <LeadSendButton leadId={lead.id} action="send_template" label={tActions("sendTemplate")} />
        </div>
      ) : (
        <ul>
          {lead.campaigns.map((campaign) => (
            <CampaignRow key={`${campaign.type}:${campaign.campaignId}`} campaign={campaign} />
          ))}
        </ul>
      )}
    </PanelSection>
  );
}
