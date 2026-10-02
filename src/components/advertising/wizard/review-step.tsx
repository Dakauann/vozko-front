"use client";

import { useTranslations } from "next-intl";

import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { ArrowClockwise, CheckCircle, Info, Warning, WarningCircle } from "@/components/icons";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import { spendBlockerKey } from "@/lib/advertising/delivery";
import { MAX_AGE, budgetFromInput, campaignBudgetActive, cleanPlacements } from "@/lib/advertising/draft";
import { EMPTY_VALUE } from "@/lib/advertising/money";
import { formatMicrosAsBrl } from "@/lib/pricing/currency";
import type { PublishBlocker, ValidationState } from "@/lib/advertising/publish";
import { adIndexOfIssue, stepOfIssue, type DraftIssue, type WizardStep } from "@/lib/advertising/wizard-issues";

import { useAdsFormat } from "../use-ads-format";
import { Hint, ReadOnlyFact, Section } from "./choice-row";
import { useIssueMessage } from "./field-issues";
import { useWizardLabels } from "./use-wizard-labels";
import { useWizard } from "./wizard-context";

export function ReviewStep({
  validation,
  blockers,
  onRevalidate,
  onGoTo,
}: {
  validation: ValidationState;
  blockers: PublishBlocker[];
  onRevalidate: () => void;
  onGoTo: (step: WizardStep, adIndex: number | null) => void;
}) {
  const t = useTranslations("adsWizard.review");
  const tAudience = useTranslations("adsWizard.audience");
  const tCampaign = useTranslations("adsWizard.campaign");
  const fmt = useAdsFormat();
  const exchangeRate = useExchangeRate();
  const labels = useWizardLabels();
  const { form, patch, account, page } = useWizard();
  const currency = account?.currency ?? "";

  const budgetText = (() => {
    if (form.mode !== "new" && campaignBudgetActive(form)) return t("budgetOnExistingCampaign");
    if (form.mode === "adSet") return t("budgetOnExistingAdSet");
    const onCampaign = campaignBudgetActive(form);
    const budget = budgetFromInput(onCampaign ? form.campaignBudget : form.adSetBudget, currency);
    if (budget.amount <= 0) return EMPTY_VALUE;
    const amount = fmt.minor(budget.amount, currency);
    const kind = budget.kind === "DAILY" ? t("budgetDaily", { amount }) : t("budgetLifetime", { amount });
    return `${kind} · ${onCampaign ? t("onCampaign") : t("onAdSet")}`;
  })();

  if (form.mode === "creative") {
    const ad = form.ads[0];
    return (
      <div className="space-y-6">
        <Section title={t("summaryTitle")}>
          <dl className="divide-y divide-border">
            <ReadOnlyFact label={t("campaign")} value={form.campaignParent?.name || EMPTY_VALUE} />
            <ReadOnlyFact label={t("adSet")} value={form.adSetParent?.name || EMPTY_VALUE} />
            <ReadOnlyFact label={t("destination")} value={labels.destination(form.destination) || EMPTY_VALUE} />
            <ReadOnlyFact
              label={t("ads")}
              value={ad ? `${ad.name.trim() || t("adFallback", { index: 1 })} (${labels.format(ad.format)})` : EMPTY_VALUE}
            />
          </dl>
        </Section>
        <Section title={t("checkTitle")} description={t("creativeCheck")}>
          {validation.status === "done" ? <IssueLinks issues={validation.issues} onGoTo={onGoTo} /> : null}
        </Section>
        <div className="space-y-2 rounded-[--radius] border border-border bg-muted px-3 py-2.5">
          <Hint icon={<Info className="h-3.5 w-3.5" aria-hidden />}>{t("creativeNote")}</Hint>
        </div>
      </div>
    );
  }

  const ageMax = form.targeting.ageMax === MAX_AGE ? tAudience("agePlus", { age: MAX_AGE }) : String(form.targeting.ageMax);
  const placements = cleanPlacements(form.placements);
  const fee = blockers.length === 0 && validation.status === "done" ? validation.fee : null;

  return (
    <div className="space-y-6">
      <Section title={t("summaryTitle")}>
        <dl className="divide-y divide-border">
          <ReadOnlyFact label={t("account")} value={account ? `${account.name} · ${account.currency}` : EMPTY_VALUE} />
          <ReadOnlyFact label={t("objective")} value={labels.objective(form.objective) || EMPTY_VALUE} />
          <ReadOnlyFact
            label={t("campaign")}
            value={(form.mode === "new" ? form.campaignName : form.campaignParent?.name) || EMPTY_VALUE}
          />
          {form.mode === "new" ? <ReadOnlyFact label={t("category")} value={tCampaign(`categories.${form.specialCategory}`)} /> : null}
          <ReadOnlyFact
            label={t("adSet")}
            value={(form.mode === "adSet" ? form.adSetParent?.name : form.adSetName || form.campaignName) || EMPTY_VALUE}
          />
          <ReadOnlyFact
            label={t("destination")}
            value={
              <>
                {labels.destination(form.destination) || EMPTY_VALUE}
                {form.goal ? ` · ${labels.goal(form.goal)}` : ""}
                {form.destination === "WHATSAPP" && form.whatsAppNumber ? (
                  <span className="tabular-nums"> · {form.whatsAppNumber}</span>
                ) : null}
              </>
            }
          />
          <ReadOnlyFact label={t("page")} value={page?.name ?? EMPTY_VALUE} />
          <ReadOnlyFact label={t("budget")} value={<span className="tabular-nums">{budgetText}</span>} />
          {form.mode !== "adSet" ? (
            <>
              <ReadOnlyFact
                label={t("schedule")}
                value={
                  <span className="tabular-nums">
                    {form.startMode === "date" && form.startDay ? t("startsOn", { day: form.startDay }) : t("startsNow")}
                    {form.endDay ? ` · ${t("endsOn", { day: form.endDay })}` : ` · ${t("noEnd")}`}
                    {form.scheduleOn && form.schedule.length > 0 ? ` · ${t("hours")}` : ""}
                  </span>
                }
              />
              <ReadOnlyFact
                label={t("locations")}
                value={
                  form.targeting.locations.length > 0 ? form.targeting.locations.map((location) => location.name).join("; ") : EMPTY_VALUE
                }
              />
              <ReadOnlyFact
                label={t("audience")}
                value={
                  <span className="tabular-nums">
                    {t("ages", { min: form.targeting.ageMin, max: ageMax })}
                    {form.targeting.advantageAudience ? ` · ${tAudience("advantage")}` : ""}
                  </span>
                }
              />
              <ReadOnlyFact
                label={t("placements")}
                value={placements.automatic ? t("placementsAuto") : (placements.platforms ?? []).map(labels.placement).join(", ")}
              />
            </>
          ) : null}
          <ReadOnlyFact
            label={t("ads")}
            value={form.ads
              .map((ad, index) => `${ad.name.trim() || t("adFallback", { index: index + 1 })} (${labels.format(ad.format)})`)
              .join("; ")}
          />
        </dl>
      </Section>

      <Section title={t("pausedTitle")}>
        <ElevatedSwitch
          checked={form.keepPaused}
          onCheckedChange={(keepPaused) => patch({ keepPaused })}
          label={t("keepPaused")}
          description={t("keepPausedHint")}
        />
      </Section>

      <Section title={t("checkTitle")} description={t("checkDescription")}>
        {blockers.length === 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-healthy-ink">
            <CheckCircle className="h-4 w-4" weight="fill" aria-hidden />
            {t("ready")}
          </p>
        ) : (
          <PublishBlockers blockers={blockers} validation={validation} onRevalidate={onRevalidate} />
        )}
        {validation.status === "done" ? <IssueLinks issues={validation.issues} onGoTo={onGoTo} /> : null}
        {fee ? (
          <dl className="divide-y divide-border rounded-[--radius] border border-border bg-muted px-3 text-sm">
            <ReadOnlyFact label={t("feePerAd")} value={<span className="tabular-nums">{formatMicrosAsBrl(fee.price, exchangeRate) ?? "…"}</span>} />
            <ReadOnlyFact
              label={t("feeTotal", { count: form.ads.length })}
              value={<span className="font-semibold tabular-nums">{formatMicrosAsBrl(fee.total, exchangeRate) ?? "…"}</span>}
            />
          </dl>
        ) : null}
      </Section>

      <div className="space-y-2 rounded-[--radius] border border-border bg-muted px-3 py-2.5">
        <Hint icon={<Info className="h-3.5 w-3.5" aria-hidden />}>{t("pausedNote")}</Hint>
        <Hint icon={<Info className="h-3.5 w-3.5" aria-hidden />}>{t("reviewNote")}</Hint>
        <Hint icon={<Info className="h-3.5 w-3.5" aria-hidden />}>{t("spendNote")}</Hint>
      </div>
    </div>
  );
}

function PublishBlockers({
  blockers,
  validation,
  onRevalidate,
}: {
  blockers: PublishBlocker[];
  validation: ValidationState;
  onRevalidate: () => void;
}) {
  const t = useTranslations("adsWizard.review.blockers");
  const tBlocker = useTranslations("adsManager.spendBlocker");
  const { account } = useWizard();
  const issueCount = validation.status === "done" ? validation.issues.length : 0;
  const accountBlocker = account ? spendBlockerKey(account) : "unknown";
  const text = (blocker: PublishBlocker) => {
    switch (blocker) {
      case "account":
        return accountBlocker ? tBlocker(accountBlocker) : t("account");
      case "validationFailed":
        return t("validationFailed", { message: validation.status === "failed" ? validation.message : "" });
      case "issues":
        return t("issues", { count: issueCount });
      default:
        return t(blocker);
    }
  };
  const canRevalidate = !blockers.includes("validating");

  return (
    <div className="space-y-2 rounded-[--radius] border border-border bg-muted px-3 py-2.5" role="status">
      <p className="text-sm font-semibold text-foreground">{t("title")}</p>
      <ul className="space-y-1">
        {blockers.map((blocker) => (
          <li key={blocker} className="flex items-start gap-2 text-sm text-warning-ink">
            <Warning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{text(blocker)}</span>
          </li>
        ))}
      </ul>
      {canRevalidate ? (
        <button
          type="button"
          onClick={onRevalidate}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-ink hover:underline"
        >
          <ArrowClockwise className="h-3.5 w-3.5" aria-hidden />
          {t("revalidate")}
        </button>
      ) : null}
    </div>
  );
}

function IssueLinks({ issues, onGoTo }: { issues: DraftIssue[]; onGoTo: (step: WizardStep, adIndex: number | null) => void }) {
  const t = useTranslations("adsWizard.review");
  const tSteps = useTranslations("adsWizard.steps");
  const message = useIssueMessage();
  const { form } = useWizard();
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {issues.map((issue) => {
        const step = stepOfIssue(issue.field, form.mode);
        const adIndex = adIndexOfIssue(issue.field);
        return (
          <li key={`${issue.field}-${issue.code}`} className="flex items-start gap-2 text-sm text-destructive-ink">
            <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              {message(issue)}
              <span className="block text-2xs text-muted-foreground">
                {tSteps(step)}
                {adIndex !== null ? ` · ${t("adFallback", { index: adIndex + 1 })}` : ""}
              </span>
            </span>
            {step !== "review" ? (
              <button
                type="button"
                onClick={() => onGoTo(step, adIndex)}
                className="shrink-0 text-xs font-semibold text-primary-ink hover:underline"
              >
                {t("fix")}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
