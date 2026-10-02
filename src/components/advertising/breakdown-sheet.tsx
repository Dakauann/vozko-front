"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { getAdLiveInsightsAction } from "@/app/actions/advertising";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { useAdsResource } from "@/components/advertising/wizard/use-ads-resource";
import { useWizardLabels } from "@/components/advertising/wizard/use-wizard-labels";
import { aggregateBreakdown } from "@/lib/advertising/live";
import type { AdAttributionWindow, AdLevel, AdRange } from "@/lib/advertising/types";

import { useAdsFormat } from "./use-ads-format";

export interface BreakdownRequest {
  group: string[];
  level: AdLevel;
  range: AdRange;
  objectIds: string[];
  windows: AdAttributionWindow[];
  scope: "selection" | "all";
}

export function useBreakdownLabel() {
  const t = useTranslations("adsManager.breakdown");
  return (group: string[]) => group.map((breakdown) => (t.has(`groups.${breakdown}`) ? t(`groups.${breakdown}`) : breakdown)).join(" + ");
}

export function BreakdownSheet({
  request,
  accountId,
  currency,
  onClose,
}: {
  request: BreakdownRequest | null;
  accountId: string;
  currency: string;
  onClose: () => void;
}) {
  const t = useTranslations("adsManager.breakdown");
  const labels = useWizardLabels();
  const fmt = useAdsFormat();
  const groupLabel = useBreakdownLabel();
  const key = request ? JSON.stringify({ accountId, ...request }) : null;
  const insights = useAdsResource(key, () =>
    getAdLiveInsightsAction(accountId, {
      level: request?.level ?? "campaign",
      range: request?.range ?? { since: "", until: "" },
      objectIds: request?.objectIds,
      breakdowns: request?.group,
      windows: request?.windows,
    }),
  );
  const slices = useMemo(
    () => (insights.status === "ready" && request ? aggregateBreakdown(insights.data.rows, request.group) : []),
    [insights, request],
  );

  const valueLabel = (breakdown: string, value: string) => {
    if (!value) return t("values.unknown");
    if (breakdown === "publisher_platform") return labels.placement(value);
    if (breakdown === "platform_position") return labels.position(value);
    return t.has(`values.${value}`) ? t(`values.${value}`) : value;
  };

  return (
    <ElevatedSheet open={!!request} onOpenChange={(open) => !open && onClose()}>
      <ElevatedSheetContent side="right" className="flex w-full flex-col sm:max-w-3xl">
        <ElevatedSheetHeader>
          <ElevatedSheetTitle className="text-xl">{request ? t("title", { group: groupLabel(request.group) }) : t("menu")}</ElevatedSheetTitle>
          <ElevatedSheetDescription>
            {request ? t(`scope.${request.scope}`, { count: request.objectIds.length }) : null} {t("liveNote")}
          </ElevatedSheetDescription>
        </ElevatedSheetHeader>
        <div className="flex-1 overflow-auto px-6 pb-6">
          {insights.status === "error" ? <p className="text-sm text-destructive-ink">{t("failed", { message: insights.message })}</p> : null}
          {insights.status === "loading" ? <div className="h-40 animate-pulse rounded-[--radius] bg-muted" /> : null}
          {insights.status === "ready" && slices.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
          {slices.length > 0 && request ? (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-strong bg-muted text-2xs font-semibold text-muted-foreground">
                  {request.group.map((breakdown) => (
                    <th key={breakdown} scope="col" className="px-3 py-2">
                      {t.has(`groups.${breakdown}`) ? t(`groups.${breakdown}`) : breakdown}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right">{t("columns.spend")}</th>
                  <th scope="col" className="px-3 py-2">{t("columns.share")}</th>
                  <th scope="col" className="px-3 py-2 text-right">{t("columns.impressions")}</th>
                  <th scope="col" className="px-3 py-2 text-right">{t("columns.reach")}</th>
                  <th scope="col" className="px-3 py-2 text-right">{t("columns.results")}</th>
                  <th scope="col" className="px-3 py-2 text-right">{t("columns.costPerResult")}</th>
                  <th scope="col" className="px-3 py-2 text-right">{t("columns.cpm")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {slices.map((slice) => (
                  <tr key={slice.key}>
                    {slice.values.map((value, index) => (
                      <td key={request.group[index]} className="px-3 py-2 text-foreground">
                        {valueLabel(request.group[index], value)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums">{fmt.micros(slice.spend, currency)}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <span className="block h-full bg-chart-1" style={{ width: `${slice.share * 100}%` }} />
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">{fmt.percent(slice.share * 100)}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt.count(slice.impressions)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt.count(slice.reach)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt.count(slice.results)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt.micros(slice.costPerResult, currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt.micros(slice.cpm, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
