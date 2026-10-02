"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { getAdsReportAction } from "@/app/actions/advertising";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import { ChatsCircle, CursorClick, DeviceMobile, Megaphone, Storefront, UserPlus, type Icon } from "@/components/icons";
import { RadioGroup } from "@/components/ui/radio-group";
import { rangeForPreset } from "@/lib/advertising/date-range";
import { emptyWizardForm, parentFromRow, withObjective, withParents, type WizardMode } from "@/lib/advertising/draft";
import type { AdObjective } from "@/lib/advertising/draft-types";
import type { AdLevel, AdRow } from "@/lib/advertising/types";
import { OBJECTIVES, routesFor } from "@/lib/advertising/wizard-routes";

import { AccountPicker } from "../account-picker";
import { useAdsFormat } from "../use-ads-format";
import { ChoiceRow, ReadOnlyFact, Section } from "./choice-row";
import { FieldIssues } from "./field-issues";
import { useAdsResource } from "./use-ads-resource";
import { useWizardLabels } from "./use-wizard-labels";
import { useWizard } from "./wizard-context";

const OBJECTIVE_ICONS: Record<AdObjective, Icon> = {
  OUTCOME_AWARENESS: Megaphone,
  OUTCOME_TRAFFIC: CursorClick,
  OUTCOME_ENGAGEMENT: ChatsCircle,
  OUTCOME_LEADS: UserPlus,
  OUTCOME_SALES: Storefront,
  OUTCOME_APP_PROMOTION: DeviceMobile,
};

const MODES: WizardMode[] = ["new", "campaign", "adSet"];

function useStructureRows(accountId: string, level: AdLevel, enabled: boolean, today: string | null) {
  const key = enabled && accountId ? `${accountId}:${level}` : null;
  return useAdsResource<AdRow[]>(key, async () => {
    const day = today ?? new Date().toISOString().slice(0, 10);
    const result = await getAdsReportAction(accountId, { level, range: rangeForPreset("last30", day) });
    return "error" in result ? result : { data: result.data.rows ?? [] };
  });
}

export function ObjectiveStep() {
  const t = useTranslations("adsWizard.objective");
  const labels = useWizardLabels();
  const fmt = useAdsFormat();
  const { form, update, accounts, account, options, issues, today } = useWizard();
  const mode = form.mode;
  const campaignRows = useStructureRows(form.accountId, "campaign", mode !== "new", today);
  const adSetRows = useStructureRows(form.accountId, "adset", mode === "adSet", today);
  const campaigns = useMemo(() => (campaignRows.status === "ready" ? campaignRows.data : []), [campaignRows]);
  const adSets = adSetRows.status === "ready" ? adSetRows.data : [];
  const currency = account?.currency ?? "";

  const chooseAccount = (accountId: string) => {
    update((current) => ({ ...emptyWizardForm(accountId), ads: current.ads }));
  };

  const chooseMode = (next: string) => {
    update((current) => ({ ...withParents(current, null, null), mode: next as WizardMode }));
  };

  const chooseCampaign = (metaId: string) => {
    const row = campaigns.find((candidate) => candidate.metaId === metaId);
    if (row) update((current) => withParents(current, parentFromRow(row), null));
  };

  const chooseAdSet = (metaId: string) => {
    const row = adSets.find((candidate) => candidate.metaId === metaId);
    if (!row) return;
    const campaign = campaigns.find((candidate) => candidate.metaId === row.campaignId);
    update((current) => withParents(current, campaign ? parentFromRow(campaign) : null, parentFromRow(row)));
  };

  const chooseObjective = (value: string) => {
    const objective = value as AdObjective;
    update((current) => withObjective(current, objective, routesFor(options, objective)));
  };

  const parentBudget = (daily: number, lifetime: number) => {
    if (daily > 0) return t("budgetDaily", { amount: fmt.minor(daily, currency) });
    if (lifetime > 0) return t("budgetLifetime", { amount: fmt.minor(lifetime, currency) });
    return t("budgetOnAdSets");
  };

  return (
    <div className="space-y-6">
      <Section title={t("accountTitle")} description={t("accountDescription")}>
        <AccountPicker accounts={accounts} value={form.accountId} onChange={chooseAccount} disabled={accounts.length < 2} className="w-full" />
        <FieldIssues issues={issues} field="adAccountId" />
      </Section>

      <Section title={t("startTitle")} description={t("startDescription")}>
        <RadioGroup value={mode} onValueChange={chooseMode} className="grid gap-2 sm:grid-cols-3">
          {MODES.map((candidate) => (
            <ChoiceRow key={candidate} value={candidate} title={t(`modes.${candidate}.title`)} hint={t(`modes.${candidate}.body`)} />
          ))}
        </RadioGroup>

        {mode !== "new" ? (
          <ElevatedCommandSelect
            label={t("campaign")}
            fullWidth
            value={form.campaignParent?.metaId ?? null}
            isLoading={campaignRows.status === "loading"}
            emptyMessage={campaignRows.status === "error" ? campaignRows.message : t("noCampaigns")}
            searchPlaceholder={t("search")}
            options={campaigns.map((row) => ({ value: row.metaId, label: row.name, description: labels.objective(row.objective) }))}
            onValueChange={chooseCampaign}
          />
        ) : null}
        {mode === "adSet" ? (
          <ElevatedCommandSelect
            label={t("adSet")}
            fullWidth
            value={form.adSetParent?.metaId ?? null}
            isLoading={adSetRows.status === "loading"}
            emptyMessage={adSetRows.status === "error" ? adSetRows.message : t("noAdSets")}
            searchPlaceholder={t("search")}
            options={adSets
              .filter((row) => !form.campaignParent || row.campaignId === form.campaignParent.metaId)
              .map((row) => ({ value: row.metaId, label: row.name, description: labels.destination(row.destinationType) }))}
            onValueChange={chooseAdSet}
          />
        ) : null}
      </Section>

      {mode === "new" ? (
        <Section title={t("title")} description={t("description")}>
          <RadioGroup value={form.objective} onValueChange={chooseObjective} className="grid gap-2 sm:grid-cols-2">
            {OBJECTIVES.map((objective) => {
              const ObjectiveIcon = OBJECTIVE_ICONS[objective];
              const available = routesFor(options, objective).length > 0;
              return (
                <ChoiceRow
                  key={objective}
                  value={objective}
                  title={t(`objectives.${objective}.title`)}
                  hint={available ? t(`objectives.${objective}.body`) : t("unavailable")}
                  icon={<ObjectiveIcon className="h-4 w-4" />}
                  disabled={!available}
                />
              );
            })}
          </RadioGroup>
          <FieldIssues issues={issues} field="campaign.objective" />
        </Section>
      ) : (
        <Section title={t("fixedTitle")} description={t("fixedDescription")}>
          {form.campaignParent || form.adSetParent ? (
            <dl className="divide-y divide-border rounded-[--radius] border border-border px-3">
              {form.campaignParent ? (
                <>
                  <ReadOnlyFact label={t("campaign")} value={form.campaignParent.name} />
                  <ReadOnlyFact label={t("objectiveLabel")} value={labels.objective(form.campaignParent.objective)} />
                  <ReadOnlyFact
                    label={t("budget")}
                    value={parentBudget(form.campaignParent.dailyBudget, form.campaignParent.lifetimeBudget)}
                  />
                </>
              ) : null}
              {form.adSetParent ? (
                <>
                  <ReadOnlyFact label={t("adSet")} value={form.adSetParent.name} />
                  <ReadOnlyFact label={t("destination")} value={labels.destination(form.destination)} />
                  <ReadOnlyFact label={t("goal")} value={labels.goal(form.goal)} />
                  {form.adSetParent.dailyBudget > 0 || form.adSetParent.lifetimeBudget > 0 ? (
                    <ReadOnlyFact
                      label={t("adSetBudget")}
                      value={parentBudget(form.adSetParent.dailyBudget, form.adSetParent.lifetimeBudget)}
                    />
                  ) : null}
                </>
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{mode === "adSet" ? t("pickAdSet") : t("pickCampaign")}</p>
          )}
          <FieldIssues issues={issues} field="campaign" nested />
          {mode === "adSet" ? <FieldIssues issues={issues} field="adSet" nested /> : null}
        </Section>
      )}
    </div>
  );
}
