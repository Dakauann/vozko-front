"use client";

import { useTranslations } from "next-intl";

import { PanelSection } from "@/components/dashboard/PanelSection";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import type { Campaign } from "@/lib/email-campaigns/types";

import { useEmailFormat } from "../shared";

interface BillingRow {
  key: string;
  label: string;
  value: string;
  detail?: string;
  strong?: boolean;
}

export function BillingSummaryPanel({ campaign, className }: { campaign: Campaign; className?: string }) {
  const t = useTranslations("emailCampaigns.detail.billing");
  const { brl, number } = useEmailFormat();
  const billing = campaign.billing;
  const show = (reais: number | null) => brl(reais) ?? t("rateUnavailable");
  const charged = billing.charged_units > 0;
  const settled = billing.settled_at !== null;

  const rows: BillingRow[] = [];
  if (charged) {
    rows.push({
      key: "charged",
      label: t("charged"),
      value: show(billing.charged_brl),
      detail: t("chargedDetail", { units: number(billing.charged_units), batches: billing.current_batch }),
    });
    rows.push({ key: "sent", label: t("sent"), value: number(billing.sent_units) });
    if (settled) {
      rows.push({ key: "refunded", label: t("refunded"), value: show(billing.refunded_brl), detail: t("refundedDetail", { count: number(billing.refunded_units) }) });
      rows.push({ key: "final", label: t("final"), value: show(billing.final_brl), strong: true });
    } else if (billing.refund_pending_micros > 0) {
      rows.push({ key: "pending", label: t("toRefund"), value: show(billing.refund_pending_brl), detail: t("toRefundEstimate") });
    }
  }

  return (
    <PanelSection
      boxed
      className={className}
      title={
        <span className="inline-flex items-center gap-1.5">
          {t("title")}
          <ExplainerHint id="emailCampaigns.billing" />
        </span>
      }
      description={charged ? t("description", { size: number(billing.batch_size) }) : t("notCharged")}
      contentClassName={charged ? "p-0" : undefined}
    >
      {charged ? (
        <dl className="divide-y divide-border">
          {rows.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <dt className="text-sm text-foreground">{row.label}</dt>
                {row.detail ? <dd className="text-2xs text-muted-foreground">{row.detail}</dd> : null}
              </div>
              <dd className={row.strong ? "readout font-display text-lg font-semibold text-foreground" : "readout text-sm font-semibold text-foreground"}>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </PanelSection>
  );
}
