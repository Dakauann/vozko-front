"use client";

import { useTranslations } from "next-intl";

import { InstrumentStrip, type Instrument } from "@/components/console/page-shapes";
import { deltaOf, type MetricDirection } from "@/lib/advertising/compare";
import { resultCount, resultKind } from "@/lib/advertising/delivery";
import type { AdMetrics, AdOutcome, AdPeriod } from "@/lib/advertising/types";

import { DeltaBadge } from "./delta-badge";
import { useAdsFormat } from "./use-ads-format";

interface KpiSpec {
  key: string;
  direction: MetricDirection;
  value: (metrics: AdMetrics, outcome: AdOutcome) => number | null;
  format: "micros" | "count" | "roas";
  tooltip?: string;
}

const KPIS: KpiSpec[] = [
  { key: "spend", direction: "neutral", value: (m) => m.spend, format: "micros" },
  { key: "results", direction: "higher", value: (m) => resultCount(m), format: "count" },
  { key: "costPerResult", direction: "lower", value: (m) => (resultKind(m) ? m.costPerResult : null), format: "micros" },
  { key: "metaConversations", direction: "higher", value: (m) => m.conversations, format: "count", tooltip: "metaConversationsHint" },
  { key: "crmConversations", direction: "higher", value: (_, o) => o.conversations, format: "count", tooltip: "crmConversationsHint" },
  { key: "costPerLead", direction: "lower", value: (_, o) => o.costPerLead, format: "micros", tooltip: "costPerLeadHint" },
  { key: "revenue", direction: "higher", value: (_, o) => o.revenue, format: "micros" },
  { key: "roas", direction: "higher", value: (_, o) => o.roas, format: "roas", tooltip: "roasHint" },
];

function sameResultKind(current: AdMetrics, previous: AdMetrics): boolean {
  return resultKind(current) !== null && resultKind(current) === resultKind(previous);
}

export function AdsKpiStrip({
  totals,
  outcome,
  previous,
  loading,
  columns = 8,
}: {
  totals: AdMetrics | null;
  outcome: AdOutcome | null;
  previous: AdPeriod | null;
  loading: boolean;
  columns?: 4 | 8;
}) {
  const t = useTranslations("adsManager.kpi");
  const tResult = useTranslations("adsManager.results");
  const fmt = useAdsFormat();
  const currency = totals?.currency ?? "";
  const kind = totals ? resultKind(totals) : null;

  const show = (spec: KpiSpec, value: number | null) =>
    spec.format === "micros" ? fmt.micros(value, currency) : spec.format === "roas" ? fmt.roas(value) : fmt.count(value);

  const instruments: Instrument[] = KPIS.map((spec) => {
    const current = totals && outcome ? spec.value(totals, outcome) : null;
    const resultBased = spec.key === "results" || spec.key === "costPerResult";
    const comparable = previous && totals && (!resultBased || sameResultKind(totals, previous.totals));
    const before = comparable ? spec.value(previous.totals, previous.outcome) : null;
    return {
      label: t(spec.key),
      value: totals && outcome ? show(spec, current) : fmt.empty,
      tooltip: spec.tooltip ? t(spec.tooltip) : undefined,
      detail:
        spec.key === "results" ? (kind ? tResult(kind) : totals?.mixedResults ? tResult("mixed") : undefined) : undefined,
      chart: previous ? <DeltaBadge delta={deltaOf(current, before, spec.direction)} previous={show(spec, before)} /> : undefined,
    };
  });

  return <InstrumentStrip instruments={instruments} loading={loading} columns={columns} compact className="rounded-[--radius]" />;
}
