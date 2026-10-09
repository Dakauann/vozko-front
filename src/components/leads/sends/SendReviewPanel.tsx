"use client";

import { useId, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  BellSlash,
  Broadcast,
  Check,
  Hourglass,
  Info,
  Minus,
  Prohibit,
  Users,
  Wallet,
  Warning,
  WarningCircle,
  WhatsappLogo,
} from "@/components/icons";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import { formatMicros } from "@/lib/advertising/money";
import {
  bindingFieldKey,
  countedRows,
  quoteCurrency,
  reviewSkipRows,
  sendBudgetView,
  type LeadSendChannel,
  type SendBudgetView,
  type SendQuote,
  type SendReview,
  type SendReviewSkipRow,
  type SendSkipRow,
  type SendSlotRef,
} from "@/lib/leads/sends";
import { useLeadFieldDefinitions } from "@/hooks/use-lead-field-definitions";
import { cn } from "@/lib/utils";

import { SendPaceLine } from "./SendPaceLine";
import { useMissingSlotText } from "./send-copy";

const ICON = "size-3.5";
const UNIT_PRICE_DIGITS = 4;

const SKIP_ICONS: Record<string, ReactNode> = {
  no_identity: <WhatsappLogo className={ICON} aria-hidden />,
  blocked: <Prohibit className={ICON} aria-hidden />,
  opted_out: <BellSlash className={ICON} aria-hidden />,
  cooldown: <Hourglass className={ICON} aria-hidden />,
  missing_variable: <Warning className={ICON} aria-hidden />,
  already_in_running_campaign: <Broadcast className={ICON} aria-hidden />,
  over_cap: <Wallet className={ICON} aria-hidden />,
};

type FirstN = { checked: boolean; onChange: (on: boolean) => void };

export function SendReviewPanel({
  review,
  firstN,
  onFirstN,
}: {
  review: SendReview;
  firstN: boolean;
  onFirstN: (on: boolean) => void;
}) {
  const { quote } = review;

  return (
    <div className="grid content-start gap-3">
      <SendCounts selected={review.entries} eligible={review.eligible} skipped={reviewSkipRows(review)} />

      <CountedNotice counted={countedRows(review.counted)} />

      <SendQuoteFacts channel={review.channel} quote={quote} />

      <SendPartsNote parts={review.parts.length} />

      <SendBudgetNotice budget={sendBudgetView(review)} quote={quote} eligible={review.eligible} firstN={{ checked: firstN, onChange: onFirstN }} />
    </div>
  );
}

export function SendCounts({ selected, eligible, skipped }: { selected: number; eligible?: number; skipped: readonly SendReviewSkipRow[] }) {
  const t = useTranslations("leadSends.review");
  const locale = useLocale();
  const overlapping = skipped.filter((row) => row.nested).length > 1;
  return (
    <>
      <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 text-sm">
        <dt className="contents">
          <span className="text-muted-foreground">
            <Users className={ICON} aria-hidden />
          </span>
          <span>{t("selected")}</span>
        </dt>
        <dd className="readout text-right font-semibold">{selected.toLocaleString(locale)}</dd>
        {eligible === undefined ? null : (
          <>
            <dt className="contents">
              <span className="text-healthy-ink">
                <Check className={ICON} aria-hidden />
              </span>
              <span className="font-semibold">{t("receive")}</span>
            </dt>
            <dd className="readout text-right font-display text-base font-semibold">{eligible.toLocaleString(locale)}</dd>
          </>
        )}
        {skipped.map((row) => (
          <SkipRow key={row.slot ? `${row.reason}:${row.slot.slot}:${row.slot.source ?? ""}` : row.reason} row={row} locale={locale} />
        ))}
      </dl>
      {overlapping ? <p className="text-xs text-muted-foreground">{t("missingOverlap")}</p> : null}
    </>
  );
}

export function SendPartsNote({ parts }: { parts: number }) {
  const t = useTranslations("leadSends.review");
  return parts > 1 ? <p className="text-xs text-muted-foreground">{t("parts", { count: parts })}</p> : null;
}

export function CountedNotice({ counted }: { counted: readonly SendSkipRow[] }) {
  const t = useTranslations("leadSends.review");
  if (counted.length === 0) return null;
  return (
    <div className="notice notice-info flex items-start gap-2 px-3 py-2.5 text-xs">
      <Info className="notice-ink mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p>{t("countedLead")}</p>
        <ul className="list-disc space-y-0.5 pl-4">
          {counted.map(({ reason, count }) => (
            <li key={reason}>{t(`counted.${reason}`, { count })}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SendQuoteFacts({ channel, quote }: { channel: LeadSendChannel; quote: SendQuote }) {
  const t = useTranslations("leadSends.review");
  const locale = useLocale();
  const currency = quoteCurrency(quote);
  const money = (micros: number, digits?: number) => formatMicros(micros, currency, locale, digits);
  if (channel === "unofficial") {
    return (
      <div className="grid gap-1 border-t border-border pt-2.5">
        <span className="text-sm text-muted-foreground">{t("pace")}</span>
        <p className="readout text-sm">
          <SendPaceLine quote={quote} emptyLabel={t("paceNone")} />
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-1 border-t border-border pt-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">{t("cost")}</span>
        <b className="readout font-display text-lg font-semibold">{money(quote.costMicros)}</b>
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
        <span className="readout">
          {t("costLine", { count: quote.count, unit: money(quote.unitPriceMicros, UNIT_PRICE_DIGITS), balance: money(quote.balanceMicros) })}
        </span>
        <span className="readout">{quote.capRemaining === undefined ? t("capNone") : t("capRemaining", { count: quote.capRemaining })}</span>
      </div>
      <p className="text-xs text-muted-foreground">{t("charged")}</p>
    </div>
  );
}

export function SendBudgetNotice({ budget, quote, eligible, firstN }: { budget: SendBudgetView; quote: SendQuote; eligible: number; firstN?: FirstN }) {
  const t = useTranslations("leadSends.review");
  if (budget.kind === "partial") {
    return <FirstNChoice refusal={budget.refusal} fits={budget.fits} eligible={eligible} choice={firstN} />;
  }
  if (budget.kind === "blocked") {
    return (
      <p role="alert" className="notice notice-fault flex items-start gap-2 px-3 py-2.5 text-xs">
        <WarningCircle className="notice-ink mt-0.5 size-4 shrink-0" aria-hidden />
        {t.has(`budget.${budget.refusal}`) ? t(`budget.${budget.refusal}`, { fits: quote.fits, count: eligible }) : t("budget.send_nothing_eligible")}
      </p>
    );
  }
  return null;
}

function CustomSlotLabel({ slot, fieldKey }: { slot: SendSlotRef; fieldKey: string }) {
  const text = useMissingSlotText();
  const label = useLeadFieldDefinitions().definitions.find((definition) => definition.key === fieldKey)?.label;
  return <>{text(slot, label)}</>;
}

function SkipRowLabel({ row: { reason, days, slot } }: { row: SendReviewSkipRow }) {
  const t = useTranslations("leadSends.review");
  const slotText = useMissingSlotText();
  const fieldKey = slot?.source ? bindingFieldKey(slot.source) : null;
  if (slot && fieldKey) return <CustomSlotLabel slot={slot} fieldKey={fieldKey} />;
  if (slot) return <>{slotText(slot)}</>;
  if (days !== undefined) return <>{t("cooldownDays", { days })}</>;
  return <>{t.has(`skipped.${reason}`) ? t(`skipped.${reason}`) : t("skipped.other")}</>;
}

export function SkipRow({ row, locale }: { row: SendReviewSkipRow; locale: string }) {
  const nested = row.nested === true;
  return (
    <>
      <dt className="contents">
        <span className="text-muted-foreground">{nested ? null : (SKIP_ICONS[row.reason] ?? <Minus className={ICON} aria-hidden />)}</span>
        <span className={cn("text-muted-foreground", nested && "pl-3 text-xs")}>
          <SkipRowLabel row={row} />
        </span>
      </dt>
      <dd className={cn("readout text-right text-muted-foreground", nested && "text-xs")}>{row.count.toLocaleString(locale)}</dd>
    </>
  );
}

function FirstNChoice({ refusal, fits, eligible, choice }: { refusal: string; fits: number; eligible: number; choice?: FirstN }) {
  const t = useTranslations("leadSends.review.budget");
  const id = useId();
  return (
    <div className="notice notice-warning grid gap-2 px-3 py-2.5 text-xs">
      <p className="flex items-start gap-2">
        <Warning className="notice-ink mt-0.5 size-4 shrink-0" aria-hidden />
        {t.has(refusal) ? t(refusal, { fits, count: eligible }) : t("unaffordable", { fits, count: eligible })}
      </p>
      {choice ? (
        <label htmlFor={id} className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox id={id} checked={choice.checked} onCheckedChange={(next) => choice.onChange(next === true)} />
          {t("firstN", { fits })}
        </label>
      ) : null}
    </div>
  );
}
