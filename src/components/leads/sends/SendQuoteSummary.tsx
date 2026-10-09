"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import { formatMicros } from "@/lib/advertising/money";
import { PreviewStateBox } from "@/components/leads/bulk/PreviewStateBox";
import type { LeadActionPreview } from "@/lib/leads/actions";
import { quoteCurrency, type LeadSendChannel } from "@/lib/leads/sends";

import { SendPaceLine } from "./SendPaceLine";

export function SendQuoteSummary({
  channel,
  waiting,
  preview,
  loading,
  refusal,
  split,
  onSplit,
  onRetry,
}: {
  channel: LeadSendChannel;
  waiting: boolean;
  preview: LeadActionPreview | null;
  loading: boolean;
  refusal: string | null;
  split: boolean;
  onSplit: (split: boolean) => void;
  onRetry: () => void;
}) {
  const t = useTranslations("leadSends.quote");
  const locale = useLocale();
  const splitId = useId();

  if (refusal && !loading) return <PreviewStateBox refusal={refusal} onRetry={onRetry} />;
  const quote = preview?.send;
  if (loading || !quote) return <PreviewStateBox pending={waiting ? t("waiting") : t("checking")} />;
  return (
    <div role="status" className="grid gap-1.5 rounded-[--radius] border border-border bg-muted px-3 py-2.5 text-sm">
      <p className="readout font-semibold text-foreground">{t("selected", { count: quote.count })}</p>
      {channel === "official" ? (
        <p className="readout text-muted-foreground">
          {t("estimate", { amount: formatMicros(quote.costMicros, quoteCurrency(quote), locale) })}
        </p>
      ) : null}
      {channel === "unofficial" ? (
        <p className="readout text-muted-foreground">
          <SendPaceLine quote={quote} emptyLabel={t("dailyNone")} />
        </p>
      ) : null}
      {quote.parts > 1 ? (
        <div className="grid gap-1.5 border-t border-border pt-1.5">
          {quote.splitRequired ? <p className="text-warning-ink">{t("splitRequired", { max: quote.maxPerCampaign })}</p> : null}
          <label htmlFor={splitId} className="flex items-center gap-2 text-foreground">
            <Checkbox id={splitId} checked={split} onCheckedChange={(next) => onSplit(next === true)} />
            {t("split", { parts: quote.parts, max: quote.maxPerCampaign })}
          </label>
        </div>
      ) : null}
    </div>
  );
}
