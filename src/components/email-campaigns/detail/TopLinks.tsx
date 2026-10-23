"use client";

import { useTranslations } from "next-intl";

import { Meter } from "@/components/charts/vozko";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import { ArrowSquareOut, LinkSimple } from "@/components/icons";
import { useEmailCampaignSection } from "@/hooks/use-email-campaigns";
import { linkLabel, share } from "@/lib/email-campaigns/format";
import type { ItemList, LinkStat } from "@/lib/email-campaigns/types";

import { EMAIL_SERIES_COLOR, useEmailFormat } from "../shared";

export function TopLinks({ campaignId, interval }: { campaignId: string; interval: number | false }) {
  const t = useTranslations("emailCampaigns.detail.links");
  const { number, locale } = useEmailFormat();
  const links = useEmailCampaignSection<ItemList<LinkStat>>(campaignId, "links", interval);
  const items = links.data?.items ?? [];
  const totalClicks = items.reduce((sum, item) => sum + item.clicks, 0);
  const pct = (value: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(totalClicks > 0 ? value / totalClicks : 0);

  return (
    <PanelSection boxed title={t("title")} description={t("description")} contentClassName="p-0">
      <SectionState query={links}>
        {links.isPending ? (
          <div className="space-y-2 px-4 py-4" aria-hidden>
            {[0, 1, 2].map((row) => (
              <span key={row} className="block h-8 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
            <LinkSimple className="h-6 w-6 opacity-50" />
            <p className="text-sm">{t("empty")}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-strong bg-muted text-left">
                <th scope="col" className="legend px-4 py-2 font-semibold">{t("columns.link")}</th>
                <th scope="col" className="legend px-3 py-2 text-right font-semibold">{t("columns.clicks")}</th>
                <th scope="col" className="legend px-3 py-2 text-right font-semibold">{t("columns.people")}</th>
                <th scope="col" className="legend w-[28%] px-4 py-2 font-semibold">{t("columns.share")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const label = linkLabel(item.url);
                return (
                  <tr key={item.url} className="border-b border-border last:border-b-0 hover:bg-muted">
                    <td className="max-w-0 px-4 py-2">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 items-center gap-1.5 text-foreground hover:underline" title={item.url}>
                        <span className="truncate">
                          <span className="font-medium">{label.host}</span>
                          <span className="text-muted-foreground">{label.path}</span>
                        </span>
                        <ArrowSquareOut className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </a>
                    </td>
                    <td className="readout px-3 py-2 text-right font-semibold">{number(item.clicks)}</td>
                    <td className="readout px-3 py-2 text-right text-muted-foreground">{number(item.unique_clickers)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Meter value={share(item.clicks, totalClicks)} color={EMAIL_SERIES_COLOR.clicks} size="sm" label={label.host} />
                        <span className="readout w-12 shrink-0 text-right text-2xs text-muted-foreground">{pct(item.clicks)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SectionState>
    </PanelSection>
  );
}
