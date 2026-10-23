"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  getCampaignButtonsAction,
  getCampaignCarriersAction,
  getCampaignFunnelAction,
  getCampaignTimelineAction,
  getCampaignVariantsAction,
} from "@/app/actions/carrier-messaging";
import { CampaignTimelineChart } from "@/components/campaigns/detail/CampaignTimelinePanel";
import { LiveFact, LiveStamp } from "@/components/campaigns/detail/live-primitives";
import { Meter } from "@/components/charts/vozko";
import { ChartSkeleton } from "@/components/dashboard/attendance/primitives";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import { PanelSection } from "@/components/dashboard/PanelSection";
import ElevatedSegmentedControl from "@/components/elevated-design/elevated-segmented-control";
import { useEmptyValue } from "@/components/elevated-design/empty-value";
import { SuggestionGlyph } from "@/components/rcs/preview/SuggestionGlyph";
import { TIMELINE_BUCKETS, type FunnelRates, type RunFunnel, type TimelineBucket, type VariantStat } from "@/lib/carrier-messaging/analytics";
import type { Campaign } from "@/lib/carrier-messaging/campaigns";
import { useMicrosMoney } from "@/lib/carrier-messaging/use-micros-money";
import { cn } from "@/lib/utils";

import { CARRIER_QUERY_OPTIONS, LIVE_REFRESH_MS, answerOrThrow, useCarrierWorkspaceId, useCountText, useRateText } from "../overview/carrier-query";
import { CarrierFallbackList } from "../overview/CarrierFallbackList";
import { FunnelBars } from "../overview/FunnelBars";
import { variantLabel } from "./detail-format";

function liveInterval(live: boolean): number | false {
  return live ? LIVE_REFRESH_MS : false;
}

function useCampaignSection<T>(section: string, campaignId: string, live: boolean, fetcher: (signal: AbortSignal) => Promise<T>, extra: unknown[] = []) {
  const workspaceId = useCarrierWorkspaceId();
  return useQuery({
    ...CARRIER_QUERY_OPTIONS,
    queryKey: ["carrier-campaign", workspaceId, campaignId, section, ...extra],
    queryFn: ({ signal }) => fetcher(signal),
    enabled: workspaceId !== "" && campaignId !== "",
    refetchInterval: liveInterval(live),
    placeholderData: keepPreviousData,
  });
}

export function LiveFunnelPanel({ campaign, live }: { campaign: Campaign; live: boolean }) {
  const t = useTranslations("carrierMessaging.pages.campaignDetail.funnel");
  const tFunnel = useTranslations("carrierMessaging.funnel");
  const tRates = useTranslations("carrierMessaging.rates");
  const format = useFormatter();
  const count = useCountText();
  const rate = useRateText();
  const money = useMicrosMoney();
  const empty = useEmptyValue();
  const query = useCampaignSection("funnel", campaign.id, live, async (signal) => answerOrThrow(await getCampaignFunnelAction(campaign.id, undefined, signal)));
  const data = query.data;
  const updated = query.dataUpdatedAt ? format.dateTime(new Date(query.dataUpdatedAt), { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;

  const facts = (funnel: RunFunnel, rates: FunnelRates) => [
    { key: "targeted", value: count(funnel.targeted), label: tFunnel("targeted"), detail: t("skipped", { count: funnel.skipped }) },
    { key: "sent", value: count(funnel.sent), label: tFunnel("sent"), detail: t("accepted", { count: funnel.accepted }) },
    { key: "delivered", value: rate(rates.delivery), label: tRates("delivery"), detail: t("ofDelivered", { count: funnel.delivered }) },
    { key: "read", value: rate(rates.read), label: tRates("read"), detail: t("ofRead", { count: funnel.read }) },
    { key: "replies", value: count(funnel.replies), label: tFunnel("replies"), detail: `${tRates("reply")} ${rate(rates.reply)}` },
    { key: "spend", value: money(funnel.spend_micros) ?? empty, label: tFunnel("spend_micros") },
  ];

  const outcomes = (funnel: RunFunnel) =>
    [
      ["rejected", funnel.rejected],
      ["failed", funnel.failed],
      ["expired", funnel.expired],
      ...(campaign.channel === "rcs" ? [["fell_back_whatsapp", funnel.fell_back_whatsapp] as const, ["fell_back_sms", funnel.fell_back_sms] as const] : []),
      ["opt_outs", funnel.opt_outs],
      ["conversions", funnel.conversions],
    ] as const;

  return (
    <section className="well overflow-hidden" aria-label={t("title")}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <LiveStamp live={live && !query.isError}>{updated ? (live ? t("liveAt", { time: updated }) : t("updatedAt", { time: updated })) : t("loading")}</LiveStamp>
      </div>
      <div className="px-4 py-4 sm:px-5">
        <SectionState query={query}>
          {data ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
                {facts(data.funnel, data.rates).map((fact, index) => (
                  <LiveFact key={fact.key} emphasis={index < 2} value={fact.value} label={fact.label} detail={fact.detail} />
                ))}
              </div>
              <FunnelBars totals={data.funnel} rates={data.rates} />
              <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3 text-sm">
                {outcomes(data.funnel).map(([key, value]) => (
                  <div key={key} className="flex items-baseline gap-1.5">
                    <dt className="text-muted-foreground">{tFunnel(key)}</dt>
                    <dd className="readout font-semibold tabular-nums text-foreground">{count(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <ChartSkeleton height={220} />
          )}
        </SectionState>
      </div>
    </section>
  );
}

export function TimelinePanel({ campaign, live }: { campaign: Campaign; live: boolean }) {
  const t = useTranslations("carrierMessaging.pages.campaignDetail.timeline");
  const [bucket, setBucket] = useState<TimelineBucket>("hour");
  const query = useCampaignSection("timeline", campaign.id, live, async (signal) => answerOrThrow(await getCampaignTimelineAction(campaign.id, bucket, signal)), [bucket]);
  return (
    <PanelSection
      boxed
      title={t("title")}
      description={t("description")}
      actions={
        <ElevatedSegmentedControl
          size="sm"
          variant="outline"
          value={bucket}
          onChange={(value) => setBucket(value as TimelineBucket)}
          options={TIMELINE_BUCKETS.map((value) => ({ value, label: t(`bucket.${value}`) }))}
        />
      }
    >
      <SectionState query={query}>{query.data ? <CampaignTimelineChart timeline={query.data} /> : <ChartSkeleton height={260} />}</SectionState>
    </PanelSection>
  );
}

export function ButtonStatsPanel({ campaign, live }: { campaign: Campaign; live: boolean }) {
  const t = useTranslations("carrierMessaging.pages.campaignDetail.buttons");
  const query = useCampaignSection("buttons", campaign.id, live, async (signal) => answerOrThrow(await getCampaignButtonsAction(campaign.id, signal)));
  const buttons = query.data ?? [];
  const most = Math.max(1, ...buttons.map((button) => button.taps));
  return (
    <PanelSection boxed title={t("title")} description={t("description")}>
      <SectionState query={query}>
        {!query.data ? (
          <ChartSkeleton height={160} />
        ) : buttons.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-3">
            {buttons.map((button) => (
              <li key={`${button.card}-${button.index}`} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3">
                <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-[--radius] border border-control-edge bg-card text-foreground">
                  <SuggestionGlyph suggestion={{ kind: button.kind, label: button.label }} className="h-4 w-4" />
                </span>
                <span className="min-w-0 space-y-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{button.label}</span>
                    <span className="shrink-0 text-2xs text-muted-foreground">{button.card < 0 ? t("inMessage") : t("inCard", { card: button.card + 1 })}</span>
                  </span>
                  <Meter value={(button.taps / most) * 100} label={button.label} />
                </span>
                <span className="text-right">
                  <span className="readout block text-sm font-semibold tabular-nums text-foreground">{t("taps", { count: button.taps })}</span>
                  {button.kind === "open_url" ? <span className="block text-2xs tabular-nums text-muted-foreground">{t("clicks", { count: button.clicks })}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionState>
    </PanelSection>
  );
}

const VARIANT_RATES = ["delivery", "read", "click_through", "reply", "conversion"] as const;

function bestOf(variants: readonly VariantStat[], key: (typeof VARIANT_RATES)[number]): number | null {
  const values = variants.map((variant) => variant.rates[key]).filter((value): value is number => value !== null);
  return values.length > 1 ? Math.max(...values) : null;
}

export function VariantsPanel({ campaign, live }: { campaign: Campaign; live: boolean }) {
  const t = useTranslations("carrierMessaging.pages.campaignDetail.variants");
  const tRates = useTranslations("carrierMessaging.rates");
  const tFunnel = useTranslations("carrierMessaging.funnel");
  const count = useCountText();
  const rate = useRateText();
  const query = useCampaignSection("variants", campaign.id, live, async (signal) => answerOrThrow(await getCampaignVariantsAction(campaign.id, signal)));
  const variants = query.data ?? [];
  return (
    <PanelSection boxed title={t("title")} description={t("description")}>
      <SectionState query={query}>
        {!query.data ? (
          <ChartSkeleton height={160} />
        ) : variants.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead>
                <tr className="border-b border-border text-left text-2xs font-semibold text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-semibold">{t("variant")}</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">{tFunnel("sent")}</th>
                  {VARIANT_RATES.map((key) => (
                    <th key={key} scope="col" className="py-2 pr-3 text-right font-semibold">{tRates(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variants.map((variant) => (
                  <tr key={variant.variant} className="border-b border-border last:border-0">
                    <th scope="row" className="py-2.5 pr-3 text-left font-medium text-foreground">
                      {variant.name.trim() || variantLabel(campaign, variant.variant, (letter) => t("fallbackName", { letter }))}
                    </th>
                    <td className="readout py-2.5 pr-3 text-right tabular-nums">{count(variant.funnel.sent)}</td>
                    {VARIANT_RATES.map((key) => {
                      const best = bestOf(variants, key);
                      const leading = best !== null && variant.rates[key] === best;
                      return (
                        <td key={key} className={cn("readout py-2.5 pr-3 text-right tabular-nums", leading ? "font-semibold text-foreground" : "text-muted-foreground")}>
                          <span className="inline-flex items-center justify-end gap-1.5">
                            {leading ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-healthy" /> : null}
                            {rate(variant.rates[key])}
                            {leading ? <span className="sr-only">{t("leading")}</span> : null}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-2xs text-muted-foreground">{t("note")}</p>
          </div>
        )}
      </SectionState>
    </PanelSection>
  );
}

export function CarriersPanel({ campaign, live }: { campaign: Campaign; live: boolean }) {
  const t = useTranslations("carrierMessaging.pages.campaignDetail.carriers");
  const query = useCampaignSection("carriers", campaign.id, live, async (signal) => answerOrThrow(await getCampaignCarriersAction(campaign.id, signal)));
  return (
    <PanelSection boxed title={t("title")} description={t("description")}>
      <SectionState query={query}>{query.data ? <CarrierFallbackList carriers={query.data} /> : <ChartSkeleton height={160} />}</SectionState>
    </PanelSection>
  );
}
