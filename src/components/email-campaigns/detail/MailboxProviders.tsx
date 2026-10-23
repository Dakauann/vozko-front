"use client";

import { useTranslations } from "next-intl";

import { Meter } from "@/components/charts/vozko";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import { Envelope } from "@/components/icons";
import { useEmailCampaignSection } from "@/hooks/use-email-campaigns";
import { share } from "@/lib/email-campaigns/format";
import type { DomainStat, ItemList } from "@/lib/email-campaigns/types";

import { EMAIL_SERIES_COLOR, useEmailFormat } from "../shared";

export function MailboxProviders({ campaignId, interval }: { campaignId: string; interval: number | false }) {
  const t = useTranslations("emailCampaigns.detail.providers");
  const { number, rate } = useEmailFormat();
  const domains = useEmailCampaignSection<ItemList<DomainStat>>(campaignId, "domains", interval);
  const items = domains.data?.items ?? [];
  const totalSent = items.reduce((sum, item) => sum + item.sent, 0);

  return (
    <PanelSection boxed title={t("title")} description={t("description")} contentClassName="p-0">
      <SectionState query={domains}>
        {domains.isPending ? (
          <div className="space-y-2 px-4 py-4" aria-hidden>
            {[0, 1, 2].map((row) => (
              <span key={row} className="block h-8 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
            <Envelope className="h-6 w-6 opacity-50" />
            <p className="text-sm">{t("empty")}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-strong bg-muted text-left">
                <th scope="col" className="legend px-4 py-2 font-semibold">{t("columns.provider")}</th>
                <th scope="col" className="legend px-3 py-2 text-right font-semibold">{t("columns.sent")}</th>
                <th scope="col" className="legend px-3 py-2 text-right font-semibold">{t("columns.delivered")}</th>
                <th scope="col" className="legend px-3 py-2 font-semibold">{t("columns.open")}</th>
                <th scope="col" className="legend px-4 py-2 font-semibold">{t("columns.bounce")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.family} className="border-b border-border last:border-b-0 hover:bg-muted">
                  <td className="px-4 py-2">
                    <span className="block font-medium text-foreground">{t(`families.${item.family}`)}</span>
                    <span className="readout block text-2xs text-muted-foreground">{t("ofSent", { percent: Math.round(share(item.sent, totalSent)) })}</span>
                  </td>
                  <td className="readout px-3 py-2 text-right font-semibold">{number(item.sent)}</td>
                  <td className="readout px-3 py-2 text-right text-muted-foreground">{number(item.delivered)}</td>
                  <td className="px-3 py-2">
                    <div className="flex min-w-[96px] flex-col gap-1">
                      <span className="readout text-xs font-semibold">{rate(item.open_rate)}</span>
                      <Meter value={item.open_rate / 100} color={EMAIL_SERIES_COLOR.opens} size="sm" label={t("columns.open")} />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex min-w-[96px] flex-col gap-1">
                      <span className="readout text-xs font-semibold">{rate(item.bounce_rate)}</span>
                      <Meter value={item.bounce_rate / 100} color={EMAIL_SERIES_COLOR.bounces} size="sm" label={t("columns.bounce")} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionState>
    </PanelSection>
  );
}
