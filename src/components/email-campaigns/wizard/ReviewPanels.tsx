"use client";

import { useTranslations } from "next-intl";

import { slotTag, useAudienceSourceLabel, useMissingFieldText } from "@/components/campaign-audience/use-audience-copy";
import { useAudienceFields } from "@/components/campaign-audience/use-audience-queries";
import { Meter } from "@/components/charts/vozko";
import { PanelSection } from "@/components/dashboard/PanelSection";
import Button from "@/components/elevated-design/button";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { ArrowRight, CircleNotch, Info, WarningCircle } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { audienceFunnel, issueFix, type IssueFix } from "@/lib/email-campaigns/review";
import { share } from "@/lib/email-campaigns/format";
import type { AudienceListSummary, AudienceSummary, LaunchIssue, MergeTagCount, Quote, Review } from "@/lib/email-campaigns/types";
import type { Hint, Issue } from "@/lib/email-design/types";
import { cn } from "@/lib/utils";

import { EMAIL_SERIES_COLOR, useEmailFormat } from "../shared";

export type Money = (micros: number, unit?: boolean) => string;

export type Reais = (reais: number | null | undefined, unit?: boolean, distinctFrom?: number) => string;

export function useMoney(exchangeRate: number | null): Money {
  const { money, unitMoney } = useEmailFormat();
  const t = useTranslations("emailCampaigns.review");
  return (micros: number, unit = false) => (unit ? unitMoney(micros, exchangeRate) : money(micros, exchangeRate)) ?? t("rateUnavailable");
}

export function useReais(): Reais {
  const { brl, unitBrl } = useEmailFormat();
  const t = useTranslations("emailCampaigns.review");
  return (reais: number | null | undefined, unit = false, distinctFrom?: number) => (unit ? unitBrl(reais) : brl(reais, distinctFrom)) ?? t("rateUnavailable");
}

const FUNNEL_COLOR = {
  matched: "hsl(var(--plate-neutral))",
  with_email: EMAIL_SERIES_COLOR.sent,
  sendable: EMAIL_SERIES_COLOR.delivered,
} as const;

export function AudienceFunnel({ audience }: { audience: AudienceSummary }) {
  const t = useTranslations("emailCampaigns.review.funnel");
  const tSkip = useTranslations("emailCampaigns.skip");
  const { number, locale } = useEmailFormat();
  const stages = audienceFunnel(audience);
  const top = Math.max(1, audience.matched);
  return (
    <ol className="space-y-3">
      {stages.map((stage) => (
        <li key={stage.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-foreground">{t(`stages.${stage.key}`)}</span>
            <span className="flex items-baseline gap-2">
              <span className="readout text-sm font-semibold text-foreground">{number(stage.value)}</span>
              <span className="readout w-14 text-right text-2xs text-muted-foreground">
                {new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(stage.value / top)}
              </span>
            </span>
          </div>
          <Meter value={share(stage.value, top)} color={FUNNEL_COLOR[stage.key]} size="md" label={t(`stages.${stage.key}`)} />
          {stage.dropped.length > 0 ? (
            <ul className="flex flex-wrap gap-x-4 gap-y-0.5 pt-0.5">
              {stage.dropped.map((row) => (
                <li key={row.reason} className="text-2xs text-muted-foreground">
                  <span className="readout font-semibold text-foreground">{t("dropped", { count: number(row.count) })}</span> {tSkip(row.reason)}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function AudienceListLine({ list }: { list: AudienceListSummary }) {
  const t = useTranslations("campaignAudience.step.list");
  const { number } = useEmailFormat();
  return (
    <p className="text-xs text-muted-foreground">
      {t.rich("matchingEmail", {
        rows: list.rows,
        existing: number(list.existing),
        created: number(list.new),
        b: (chunks) => <b className="text-foreground">{chunks}</b>,
      })}
    </p>
  );
}

export function AudiencePanel({ audience, className }: { audience: AudienceSummary; className?: string }) {
  const t = useTranslations("emailCampaigns.review.funnel");
  return (
    <PanelSection boxed className={className} title={t("title")} description={t("description")}>
      <div className="space-y-4">
        <AudienceFunnel audience={audience} />
        {audience.list ? <AudienceListLine list={audience.list} /> : null}
      </div>
    </PanelSection>
  );
}

function MergeTagPolicy({ variable }: { variable: MergeTagCount }) {
  const t = useTranslations("emailCampaigns.review.mergeTags");
  if (variable.policy === "exclude") return <span>{t("exclude")}</span>;
  if (variable.policy === "text") return <span>{t("text", { text: variable.text ?? "" })}</span>;
  return <span>{variable.fallback ? t("fallback", { text: variable.fallback }) : t("empty")}</span>;
}

export function MergeTagsPanel({ variables }: { variables: readonly MergeTagCount[] }) {
  const tMerge = useTranslations("emailEditor.mergeTags");
  const t = useTranslations("emailCampaigns.review.mergeTags");
  const tStep = useTranslations("campaignAudience.step.variables");
  const fields = useAudienceFields("email").data ?? [];
  const labelOf = useAudienceSourceLabel("email", fields);
  const missingText = useMissingFieldText("email", fields);
  const { number } = useEmailFormat();
  if (variables.length === 0) return null;
  return (
    <PanelSection boxed title={tMerge("title")} description={t("description")} contentClassName="p-0">
      <ul className="divide-y divide-border">
        {variables.map((variable) => (
          <li key={variable.key} className="grid grid-cols-[minmax(4rem,auto)_minmax(0,1fr)] items-start gap-x-3 gap-y-1 px-4 py-3">
            <span className="readout mt-0.5 w-fit rounded-[--radius] bg-muted px-1.5 font-mono text-xs font-semibold text-foreground">{slotTag({ name: variable.key })}</span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-foreground">{labelOf(variable.key)}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden className={cn("h-2 w-2 rounded-full", variable.missing > 0 ? "bg-warning" : "bg-healthy")} />
                {variable.missing > 0 ? (
                  <>
                    <b className="readout font-semibold text-foreground">{number(variable.missing)}</b>
                    {missingText(variable.key)}
                    <span aria-hidden>·</span>
                    <MergeTagPolicy variable={variable} />
                  </>
                ) : (
                  tStep("allHave")
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </PanelSection>
  );
}

function QuoteLine({ quote, label }: { quote: Quote; label: string }) {
  const t = useTranslations("emailCampaigns.review");
  const { number } = useEmailFormat();
  const reais = useReais();
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-sm text-muted-foreground">
        {label} · {t("unitsTimesPrice", { units: number(quote.units), price: reais(quote.unit_brl, true) })}
      </span>
      <span className="readout font-display text-lg font-semibold text-foreground">{reais(quote.total_brl)}</span>
    </div>
  );
}

export function CostPanel({ review, className }: { review: Review; className?: string }) {
  const t = useTranslations("emailCampaigns.review.cost");
  const { number } = useEmailFormat();
  const reais = useReais();
  const short = review.missing_micros > 0;
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
      description={t("description")}
    >
      <div className="space-y-3">
        {review.send.units > 0 ? (
          <>
            <QuoteLine quote={review.send} label={t("send")} />
            <QuoteLine quote={review.first_batch} label={t("firstBatch")} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("nothing")}</p>
        )}
        <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          <div className="bg-card px-3 py-2">
            <dt className="legend">{t("balance")}</dt>
            <dd className="readout font-display text-base font-semibold text-foreground">{reais(review.balance_brl)}</dd>
          </div>
          <div className="bg-card px-3 py-2">
            <dt className="legend">{short ? t("missingFirstBatch") : t("afterFirstBatch")}</dt>
            <dd className={cn("readout font-display text-base font-semibold", short ? "text-destructive-ink" : "text-foreground")}>
              {short ? reais(review.missing_brl) : reais(review.after_first_batch_brl, false, review.balance_brl)}
            </dd>
          </div>
        </dl>
        <p className="text-2xs leading-relaxed text-muted-foreground">{t("batchNote", { size: number(review.batch_size) })}</p>
        {short ? <Button variant="secondary" size="sm" title={t("topUp")} link="/dashboard/balance" newTab={false} /> : null}
      </div>
    </PanelSection>
  );
}

export function issueValues(issue: LaunchIssue, money: Money) {
  return { missing: money(issue.missing_micros ?? 0), addresses: issue.addresses ?? 0 };
}

function IssueRow({ issue, money, onFix }: { issue: LaunchIssue; money: Money; onFix: (fix: IssueFix) => void }) {
  const t = useTranslations("emailCampaigns.review.check");
  const tEditor = useTranslations("emailEditor.issues");
  const fix = issueFix(issue.code);
  const values = issueValues(issue, money);
  const nested: Issue[] = issue.issues ?? [];
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <WarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive-ink" weight="fill" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-foreground">{t(`issues.${issue.code}.title`, values)}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{t(`issues.${issue.code}.body`, values)}</p>
        {nested.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-4 text-2xs text-muted-foreground">
            {nested.slice(0, 5).map((child, index) => (
              <li key={`${child.code}-${child.block_id ?? ""}-${index}`}>{tEditor.has(child.code) ? tEditor(child.code) : child.code}</li>
            ))}
            {nested.length > 5 ? <li>{t("more", { count: nested.length - 5 })}</li> : null}
          </ul>
        ) : null}
      </div>
      {fix.kind === "wait" ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-2xs text-muted-foreground" role="status">
          <CircleNotch className="h-3.5 w-3.5 animate-spin" />
          {t("waiting")}
        </span>
      ) : (
        <Button variant="secondary" size="sm" title={t(`fix.${fix.kind === "link" ? issue.code : fix.step}`)} icon={<ArrowRight className="h-3.5 w-3.5" />} iconVisible iconSide="right" onClick={() => onFix(fix)} />
      )}
    </li>
  );
}

export function LaunchCheckPanel({ review, money, onFix }: { review: Review; money: Money; onFix: (fix: IssueFix) => void }) {
  const t = useTranslations("emailCampaigns.review.check");
  const tHints = useTranslations("emailEditor.hints");
  const blocking = review.check.blocking;
  const hints: Hint[] = review.check.hints;
  return (
    <PanelSection boxed title={t("title")} description={t("description")} contentClassName="p-0">
      {blocking.length === 0 ? (
        <div className="px-4 py-4">
          <Notice tone="healthy" title={t("ready")}>
            <p>{t("readyBody")}</p>
          </Notice>
        </div>
      ) : (
        <ul className="divide-y divide-border" aria-label={t("blockingLabel", { count: blocking.length })}>
          {blocking.map((issue) => (
            <IssueRow key={issue.code} issue={issue} money={money} onFix={onFix} />
          ))}
        </ul>
      )}
      {hints.length > 0 ? (
        <div className="border-t border-border px-4 py-3">
          <p className="legend mb-1.5">{t("hints", { count: hints.length })}</p>
          <ul className="space-y-1">
            {hints.map((hint, index) => (
              <li key={`${hint.code}-${hint.block_id ?? ""}-${index}`} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info-ink" weight="fill" />
                {tHints.has(hint.code) ? tHints(hint.code) : hint.code}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </PanelSection>
  );
}


export function TestBatchPanel({ review, className }: { review: Review; className?: string }) {
  const t = useTranslations("emailCampaigns.review.testBatch");
  const { number } = useEmailFormat();
  const rest = Math.max(0, review.audience.sendable - review.test_batch);
  return (
    <PanelSection boxed className={className} title={t("title")} description={t("description", { neverMailed: number(review.audience.never_mailed) })}>
      <div className="space-y-3">
        <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          <div className="bg-card px-3 py-2">
            <dt className="legend">{t("first")}</dt>
            <dd className="readout font-display text-base font-semibold text-foreground">{number(review.test_batch)}</dd>
          </div>
          <div className="bg-card px-3 py-2">
            <dt className="legend">{t("rest")}</dt>
            <dd className="readout font-display text-base font-semibold text-foreground">{number(rest)}</dd>
          </div>
        </dl>
        <p className="text-2xs leading-relaxed text-muted-foreground">{t("rule")}</p>
      </div>
    </PanelSection>
  );
}
