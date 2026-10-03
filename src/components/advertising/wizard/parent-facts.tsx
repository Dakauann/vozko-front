"use client";

import { useTranslations } from "next-intl";

import type { ParentSummary } from "@/lib/advertising/draft";

import { useAdsFormat } from "../use-ads-format";
import { ReadOnlyFact, Section } from "./choice-row";
import { FieldIssues } from "./field-issues";
import { useWizardLabels } from "./use-wizard-labels";
import { useWizard } from "./wizard-context";

function useParentBudget() {
  const t = useTranslations("adsWizard.objective");
  const fmt = useAdsFormat();
  const { account } = useWizard();
  const currency = account?.currency ?? "";
  return (parent: ParentSummary) => {
    if (parent.dailyBudget > 0) return t("budgetDaily", { amount: fmt.minor(parent.dailyBudget, currency) });
    if (parent.lifetimeBudget > 0) return t("budgetLifetime", { amount: fmt.minor(parent.lifetimeBudget, currency) });
    return t("budgetOnAdSets");
  };
}

export function CampaignParentFacts() {
  const t = useTranslations("adsWizard.objective");
  const labels = useWizardLabels();
  const budgetText = useParentBudget();
  const { form, issues } = useWizard();
  const parent = form.campaignParent;
  return (
    <Section title={t("fixedTitle")} description={t("fixedDescription")}>
      {parent ? (
        <dl className="divide-y divide-border rounded-[--radius] border border-border px-3">
          <ReadOnlyFact label={t("campaign")} value={parent.name || parent.metaId} />
          <ReadOnlyFact label={t("objectiveLabel")} value={labels.objective(form.objective || parent.objective)} />
          <ReadOnlyFact label={t("budget")} value={budgetText(parent)} />
        </dl>
      ) : null}
      <FieldIssues issues={issues} field="campaign" nested />
      <FieldIssues issues={issues} field="adAccountId" />
    </Section>
  );
}

export function AdSetParentFacts() {
  const t = useTranslations("adsWizard.objective");
  const labels = useWizardLabels();
  const budgetText = useParentBudget();
  const { form, issues } = useWizard();
  const parent = form.adSetParent;
  return (
    <Section title={t("fixedTitle")} description={t("fixedDescription")}>
      {parent ? (
        <dl className="divide-y divide-border rounded-[--radius] border border-border px-3">
          <ReadOnlyFact label={t("adSet")} value={parent.name || parent.metaId} />
          <ReadOnlyFact label={t("destination")} value={labels.destination(form.destination)} />
          <ReadOnlyFact label={t("goal")} value={labels.goal(form.goal)} />
          {parent.dailyBudget > 0 || parent.lifetimeBudget > 0 ? <ReadOnlyFact label={t("adSetBudget")} value={budgetText(parent)} /> : null}
        </dl>
      ) : null}
      <FieldIssues issues={issues} field="adSet" nested />
    </Section>
  );
}
