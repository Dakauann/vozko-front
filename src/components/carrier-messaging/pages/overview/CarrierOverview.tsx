"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { getCarrierOverviewAction } from "@/app/actions/carrier-messaging";
import { ChartSkeleton, KpiGroup, type KpiTile } from "@/components/dashboard/attendance/primitives";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import { useEmptyValue } from "@/components/elevated-design/empty-value";
import { LiveFact } from "@/components/campaigns/detail/live-primitives";
import {
  ChartBar,
  ChatCircle,
  CheckCircle,
  CursorClick,
  Eye,
  PaperPlaneTilt,
  Prohibit,
  Receipt,
  Target,
  Wallet,
} from "@/components/icons";
import { GLYPH_PLATE } from "@/components/icons/glyph-plates";
import { OVERVIEW_CHANNELS, OVERVIEW_DAYS, type Overview, type OverviewChannel, type OverviewDays } from "@/lib/carrier-messaging/analytics";
import { useMicrosMoney } from "@/lib/carrier-messaging/use-micros-money";

import { CARRIER_QUERY_OPTIONS, answerOrThrow, useCarrierWorkspaceId, useCountText, useRateText } from "./carrier-query";
import { CarrierFallbackList } from "./CarrierFallbackList";
import { ComingSoonChip } from "../../shared/ComingSoon";
import { useCarrierChannels } from "@/lib/carrier-messaging/use-carrier-channels";
import { ChannelCostCompare } from "./ChannelCostCompare";
import { DailyCharts } from "./DailyCharts";
import { FunnelBars } from "./FunnelBars";
import { CarrierAreaGate } from "@/components/carrier-messaging/shared/ComingSoon";

function useOverview(days: OverviewDays, channel: OverviewChannel) {
  const workspaceId = useCarrierWorkspaceId();
  return useQuery({
    ...CARRIER_QUERY_OPTIONS,
    queryKey: ["carrier-overview", workspaceId, days, channel],
    queryFn: async ({ signal }) => answerOrThrow(await getCarrierOverviewAction(days, channel, signal)),
    enabled: workspaceId !== "",
    placeholderData: keepPreviousData,
  });
}

function KpiBand({ overview, loading }: { overview: Overview; loading: boolean }) {
  const t = useTranslations("carrierMessaging.pages.overview.kpis");
  const count = useCountText();
  const rate = useRateText();
  const money = useMicrosMoney();
  const empty = useEmptyValue();
  const { totals, rates } = overview;
  const cost = rates.cost_per_conversion_micros;
  const reach: KpiTile[] = [
    { key: "sent", label: t("sent.label"), short: t("sent.short"), hint: t("sent.hint"), value: count(totals.sent), icon: PaperPlaneTilt, bg: GLYPH_PLATE.PaperPlaneTilt },
    { key: "delivery", label: t("delivery.label"), short: t("delivery.short", { count: totals.delivered }), hint: t("delivery.hint"), value: rate(rates.delivery), icon: CheckCircle, bg: GLYPH_PLATE.CheckCircle },
    { key: "read", label: t("read.label"), short: t("read.short", { count: totals.read }), hint: t("read.hint"), value: rate(rates.read), icon: Eye, bg: GLYPH_PLATE.ChartLine },
    { key: "ctr", label: t("ctr.label"), short: t("ctr.short", { count: totals.clicks }), hint: t("ctr.hint"), value: rate(rates.click_through), icon: CursorClick, bg: GLYPH_PLATE.Target },
    { key: "replies", label: t("replies.label"), short: t("replies.short", { rate: rate(rates.reply) }), hint: t("replies.hint"), value: count(totals.replies), icon: ChatCircle, bg: GLYPH_PLATE.ChatCircle },
  ];
  const results: KpiTile[] = [
    { key: "optOuts", label: t("optOuts.label"), short: t("optOuts.short", { rate: rate(rates.opt_out) }), hint: t("optOuts.hint"), value: count(totals.opt_outs), icon: Prohibit, bg: GLYPH_PLATE.Prohibit },
    { key: "conversions", label: t("conversions.label"), short: t("conversions.short", { rate: rate(rates.conversion) }), hint: t("conversions.hint"), value: count(totals.conversions), icon: Target, bg: GLYPH_PLATE.Target },
    { key: "spend", label: t("spend.label"), short: t("spend.short"), hint: t("spend.hint"), value: money(totals.spend_micros) ?? empty, icon: Wallet, bg: GLYPH_PLATE.Wallet },
    {
      key: "costPerConversion",
      label: t("costPerConversion.label"),
      short: t("costPerConversion.short"),
      hint: t("costPerConversion.hint"),
      value: cost === null ? empty : (money(cost) ?? empty),
      icon: Receipt,
      bg: GLYPH_PLATE.Receipt,
      muted: cost === null,
    },
  ];
  return (
    <div className="grid gap-4">
      <KpiGroup title={t("reachTitle")} cards={reach} loading={loading} />
      <KpiGroup title={t("resultTitle")} cards={results} loading={loading} />
    </div>
  );
}

function FallbackFacts({ overview }: { overview: Overview }) {
  const t = useTranslations("carrierMessaging.funnel");
  const tPage = useTranslations("carrierMessaging.pages.overview.funnel");
  const count = useCountText();
  const money = useMicrosMoney();
  const empty = useEmptyValue();
  const { totals } = overview;
  return (
    <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
      <LiveFact value={count(totals.fell_back_whatsapp)} label={t("fell_back_whatsapp")} />
      <LiveFact value={count(totals.fell_back_sms)} label={t("fell_back_sms")} />
      <LiveFact value={count(totals.failed)} label={t("failed")} />
      <LiveFact value={money(totals.conversion_value_micros) ?? empty} label={t("conversion_value_micros")} detail={tPage("revenueHint")} />
    </div>
  );
}

function CarrierOverviewBody() {
  const t = useTranslations("carrierMessaging.pages.overview");
  const tChannels = useTranslations("carrierMessaging.channels");
  const [days, setDays] = useState<OverviewDays>(30);
  const [channel, setChannel] = useState<OverviewChannel>("all");
  const carrierChannels = useCarrierChannels();
  const soon = (value: OverviewChannel) => value !== "all" && !carrierChannels.launched(value);
  const overview = useOverview(days, channel);
  const data = overview.data;
  const loading = overview.isFetching && !data;

  return (
    <motion.main className="w-full space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <DashboardPageHeader
        icon={<ChartBar className="h-6 w-6" weight="fill" />}
        badge={t("header.badge")}
        description={t("header.description")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ElevatedPillToggle<OverviewChannel>
              size="md"
              aria-label={t("filters.channel")}
              value={channel}
              onChange={setChannel}
              options={OVERVIEW_CHANNELS.map((value) => ({
                value,
                label: soon(value) ? (
                  <span className="inline-flex items-center gap-1.5">
                    {tChannels(value)}
                    <ComingSoonChip />
                  </span>
                ) : (
                  tChannels(value)
                ),
                title: tChannels(value),
                disabled: soon(value),
              }))}
            />
            <ElevatedPillToggle<string>
              size="md"
              aria-label={t("filters.period")}
              value={String(days)}
              onChange={(value) => setDays(Number(value) as OverviewDays)}
              options={OVERVIEW_DAYS.map((value) => ({ value: String(value), label: t("filters.days", { count: value }) }))}
            />
          </div>
        }
      />

      <SectionState query={overview}>
        {data ? (
          <div className="space-y-8" aria-busy={overview.isFetching}>
            <KpiBand overview={data} loading={loading} />

            <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <PanelSection title={t("funnel.title")} description={t("funnel.description")}>
                <FunnelBars totals={data.totals} rates={data.rates} />
                <div className="mt-4">
                  <FallbackFacts overview={data} />
                </div>
              </PanelSection>
              <PanelSection title={t("cost.title")} description={t("cost.description")}>
                <ChannelCostCompare channels={data.channels.filter((entry) => entry.channel === "whatsapp" || carrierChannels.launched(entry.channel))} />
              </PanelSection>
            </div>

            <PanelSection title={t("daily.title")} description={t("daily.description")}>
              <DailyCharts daily={data.daily} />
            </PanelSection>

            <PanelSection title={t("carriers.title")} description={t("carriers.description")}>
              <CarrierFallbackList carriers={data.carriers} />
            </PanelSection>
          </div>
        ) : (
          <ChartSkeleton height={320} />
        )}
      </SectionState>
    </motion.main>
  );
}

export function CarrierOverview() {
  const t = useTranslations("carrierMessaging.pages.overview");
  return (
    <CarrierAreaGate badge={t("header.badge")} description={t("header.description")}>
      <CarrierOverviewBody />
    </CarrierAreaGate>
  );
}
