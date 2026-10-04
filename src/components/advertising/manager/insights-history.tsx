"use client";

import { useLocale, useTranslations } from "next-intl";

import { listAdHistoryAction } from "@/app/actions/advertising";
import type { AdAccount, AdActivity, AdRange, AdRow } from "@/lib/advertising/types";
import { formatWhen } from "@/lib/advertising/when";

import { useAdsErrorText } from "../use-ads-error";
import { useAdsFormat } from "../use-ads-format";
import { useAdsResource } from "../wizard/use-ads-resource";

function ChangeText({ activity }: { activity: AdActivity }) {
  const t = useTranslations("adsManager.insights.history");
  if (activity.from && activity.to) return <>{t("change", { from: activity.from, to: activity.to })}</>;
  if (activity.to) return <>{activity.to}</>;
  return <span className="text-muted-foreground">{t("noDetails")}</span>;
}

export function InsightsHistory({ account, row, range }: { account: AdAccount; row: AdRow; range: AdRange | null }) {
  const t = useTranslations("adsManager.insights.history");
  const locale = useLocale();
  const fmt = useAdsFormat();
  const errorText = useAdsErrorText();
  const key = range ? `insights-history:${account.id}:${row.metaId}:${range.since}:${range.until}:${locale}:${account.lastSyncedAt ?? ""}` : null;
  const history = useAdsResource<AdActivity[]>(key, () => listAdHistoryAction(row.metaId, range ?? { since: "", until: "" }, locale));

  if (history.status === "loading" || history.status === "idle") return <div className="h-40 animate-pulse rounded-[--radius] bg-muted" />;
  if (history.status === "error") return <p className="text-sm text-destructive-ink">{errorText({ error: history.message, code: history.code })}</p>;
  if (history.data.length === 0) return <p className="rounded-[--radius] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>;

  return (
    <div className="overflow-x-auto rounded-[--radius] border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted">
          <tr className="border-b border-border-strong text-2xs font-semibold text-muted-foreground">
            <th scope="col" className="px-3 py-2">{t("columns.activity")}</th>
            <th scope="col" className="px-3 py-2">{t("columns.details")}</th>
            <th scope="col" className="px-3 py-2">{t("columns.item")}</th>
            <th scope="col" className="px-3 py-2">{t("columns.actor")}</th>
            <th scope="col" className="px-3 py-2 text-right">{t("columns.when")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {history.data.map((activity, index) => (
            <tr key={`${activity.at}:${activity.objectId}:${activity.eventType}:${index}`} className="align-top">
              <td className="px-3 py-2 font-medium text-foreground">{activity.label || activity.eventType}</td>
              <td className="px-3 py-2 text-foreground">
                <ChangeText activity={activity} />
              </td>
              <td className="px-3 py-2">
                <span className="block text-foreground">{activity.objectName || activity.objectId}</span>
                <span className="block text-2xs text-muted-foreground">{activity.objectId}</span>
              </td>
              <td className="px-3 py-2 text-foreground">{activity.actorName || t("meta")}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">{formatWhen(activity.at, fmt.tag)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
