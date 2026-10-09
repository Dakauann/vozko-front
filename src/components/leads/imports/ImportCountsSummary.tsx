"use client";

import { useId } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { EmptyValue } from "@/components/elevated-design/empty-value";
import { MapPin } from "@/components/icons";
import {
  importIssueEntries,
  importIssueTotal,
  importPlacementRows,
  type LeadImportCounts,
  type LeadImportPlacement,
  type LeadImportPlacementBucket,
} from "@/lib/leads/imports";
import { cn } from "@/lib/utils";

import { importReasonLabel, type ImportTranslator } from "./import-messages";

type Tense = "planned" | "done";

const BUCKET_TONE: Record<LeadImportPlacementBucket, string> = {
  precise: "bg-chart-1",
  approximate: "bg-chart-2",
  pending: "bg-control-edge",
  notLocated: "bg-warning",
  noAddress: "bg-border-strong",
};

export function ImportCountsSummary({
  counts,
  tense,
  finished = false,
  placement,
}: {
  counts: LeadImportCounts;
  tense: Tense;
  finished?: boolean;
  placement?: LeadImportPlacement;
}) {
  const t = useTranslations("leadsPage.import") as unknown as ImportTranslator;
  const format = useFormatter();
  const n = (value: number) => format.number(value);

  const rows: { key: string; value: number; muted?: boolean }[] = [
    { key: "created", value: counts.created },
    { key: "enriched", value: counts.enriched },
    { key: "unchanged", value: counts.unchanged },
    { key: "skipped", value: counts.skipped },
    { key: "conflicting", value: counts.conflicting },
    { key: "blocked", value: counts.blocked },
    { key: "links", value: tense === "planned" ? counts.linksPlanned : counts.linksCreated },
    { key: "rejected", value: counts.rejected, muted: true },
  ].filter((row) => row.key === "created" || row.value > 0);

  const issues = importIssueEntries(counts);
  const issueTotal = importIssueTotal(counts);

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-sm">
        {rows.map((row) => (
          <div key={row.key} className="contents">
            <dt className={cn(row.muted ? "text-muted-foreground" : "text-foreground")}>{t(`counts.${tense}.${row.key}`)}</dt>
            <dd className={cn("readout text-right font-semibold tabular-nums", row.muted ? "text-muted-foreground" : "text-foreground")}>
              {n(row.value)}
            </dd>
          </div>
        ))}
      </dl>

      {finished ? <ImportPlacementCard counts={counts} placement={placement} /> : <AddressQueue counts={counts} />}

      {issues.length > 0 ? (
        <details className="rounded-[--radius] border border-border bg-card px-3.5 py-2.5">
          <summary className="cursor-pointer text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {t("issues.title", { count: n(issueTotal) })}
          </summary>
          <ul className="mt-2 space-y-1">
            {issues.map(([reason, count]) => (
              <li key={reason} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 text-muted-foreground">{importReasonLabel(t, reason)}</span>
                <span className="readout shrink-0 tabular-nums text-foreground">{n(count)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function AddressQueue({ counts }: { counts: LeadImportCounts }) {
  const t = useTranslations("leadsPage.import");
  const format = useFormatter();
  const n = (value: number) => format.number(value);
  const addresses = counts.addressesAdded + counts.addressesFilled;
  if (addresses === 0 && !counts.noAddress) return null;
  const pending = Math.max(0, counts.addressesAdded - counts.addressesLocated);

  return (
    <div className="space-y-2 rounded-[--radius] border border-border bg-card px-3.5 py-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" weight="fill" aria-hidden />
        {t("addresses.title")}
      </p>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-xs">
        <dt className="text-foreground">{t("addresses.added")}</dt>
        <dd className="readout text-right font-semibold tabular-nums text-foreground">{n(counts.addressesAdded)}</dd>
        {counts.addressesFilled > 0 ? (
          <>
            <dt className="text-foreground">{t("addresses.filled")}</dt>
            <dd className="readout text-right font-semibold tabular-nums text-foreground">{n(counts.addressesFilled)}</dd>
          </>
        ) : null}
        <dt className="text-foreground">{t("addresses.located")}</dt>
        <dd className="readout text-right font-semibold tabular-nums text-foreground">{n(counts.addressesLocated)}</dd>
        <dt className="text-muted-foreground">{t("addresses.pending")}</dt>
        <dd className="readout text-right font-semibold tabular-nums text-muted-foreground">{n(pending)}</dd>
        <dt className="text-muted-foreground">{t("addresses.noAddress")}</dt>
        <dd className="readout text-right font-semibold tabular-nums text-muted-foreground">
          {counts.noAddress === undefined ? <EmptyValue /> : n(counts.noAddress)}
        </dd>
      </dl>
      <p className="text-2xs text-muted-foreground">{t("addresses.help")}</p>
    </div>
  );
}

function ImportPlacementCard({ counts, placement }: { counts: LeadImportCounts; placement?: LeadImportPlacement }) {
  const t = useTranslations("leadsPage.import");
  const format = useFormatter();
  const titleId = useId();
  const rows = importPlacementRows(placement, counts.noAddress);
  const visible = placement
    ? rows.some((row) => (row.value ?? 0) > 0)
    : counts.addressesAdded + counts.addressesFilled > 0 || (counts.noAddress ?? 0) > 0;
  if (!visible) return null;

  return (
    <section aria-labelledby={titleId} className="space-y-2.5 rounded-[--radius] border border-border bg-card px-3.5 py-3">
      <h4 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" weight="fill" aria-hidden />
        {t("placement.title")}
      </h4>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 text-xs">
            <span className="min-w-0 text-foreground">{t(`placement.rows.${row.key}`)}</span>
            <span className="readout text-right font-semibold tabular-nums text-foreground">
              {row.value === null ? <EmptyValue /> : format.number(row.value)}
            </span>
            {row.percent !== null ? (
              <span aria-hidden className="col-span-2 block h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn("block h-full rounded-full", BUCKET_TONE[row.key])}
                  style={{ width: `${row.value ? Math.max(row.percent, 1) : 0}%` }}
                />
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <p className="text-2xs text-muted-foreground">{t("placement.source")}</p>
    </section>
  );
}
