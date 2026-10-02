"use client";

import { useTranslations } from "next-intl";

import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { ArrowClockwise, CheckCircle, Info, WarningCircle } from "@/components/icons";
import { MAX_AGE, budgetFromInput, campaignBudgetActive, cleanPlacements, draftFeeTotal } from "@/lib/advertising/draft";
import type { AdDraftFee } from "@/lib/advertising/draft-types";
import { EMPTY_VALUE } from "@/lib/advertising/money";
import { adIndexOfIssue, stepOfIssue, type DraftIssue, type WizardStep } from "@/lib/advertising/wizard-issues";

import { useAdsFormat } from "../use-ads-format";
import { Hint, ReadOnlyFact, Section } from "./choice-row";
import { useIssueMessage } from "./field-issues";
import { useWizardLabels } from "./use-wizard-labels";
import { useWizard } from "./wizard-context";

export type ValidationState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "failed"; message: string }
  | { status: "done"; key: string; issues: DraftIssue[]; fee: AdDraftFee | null };

export function ReviewStep({
  validation,
  stale,
  onRevalidate,
  onGoTo,
}: {
  validation: ValidationState;
  stale: boolean;
  onRevalidate: () => void;
  onGoTo: (step: WizardStep, adIndex: number | null) => void;
}) {
  const t = useTranslations("adsWizard.review");
  const tAudience = useTranslations("adsWizard.audience");
  const tCampaign = useTranslations("adsWizard.campaign");
  const fmt = useAdsFormat();
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
  const fee = validation.status === "done" && !stale ? validation.fee : null;

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
        {validation.status === "validating" ? <p className="text-sm text-muted-foreground">{t("validating")}</p> : null}
        {validation.status === "failed" ? <p className="text-sm text-destructive-ink">{validation.message}</p> : null}
        {stale ? <p className="text-sm text-warning-ink">{t("stale")}</p> : null}
        {validation.status === "done" && !stale && validation.issues.length === 0 && validation.fee ? (
          <p className="flex items-center gap-1.5 text-sm text-healthy-ink">
            <CheckCircle className="h-4 w-4" weight="fill" aria-hidden />
            {t("ready")}
          </p>
        ) : null}
        {validation.status === "done" && !stale && validation.issues.length === 0 && !validation.fee ? (
          <p className="text-sm text-warning-ink">{t("feeMissing")}</p>
        ) : null}
        {validation.status === "done" ? <IssueLinks issues={validation.issues} onGoTo={onGoTo} /> : null}
        {validation.status !== "validating" ? (
          <button
            type="button"
            onClick={onRevalidate}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-ink hover:underline"
          >
            <ArrowClockwise className="h-3.5 w-3.5" aria-hidden />
            {t("revalidate")}
          </button>
        ) : null}
        {fee ? (
          <dl className="divide-y divide-border rounded-[--radius] border border-border bg-muted px-3 text-sm">
            <ReadOnlyFact label={t("feePerAd")} value={<span className="tabular-nums">{fmt.micros(fee.price, fee.currency)}</span>} />
            <ReadOnlyFact
              label={t("feeTotal", { count: form.ads.length })}
              value={<span className="font-semibold tabular-nums">{fmt.micros(draftFeeTotal(fee, form.ads.length), fee.currency)}</span>}
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
