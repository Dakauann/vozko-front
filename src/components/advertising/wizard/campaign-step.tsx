"use client";

import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { Lock } from "@/components/icons";
import { LOWEST_COST, MAX_NAME, SPECIAL_CATEGORIES, isRestrictedCategory, withSpecialCategory } from "@/lib/advertising/draft";
import type { AdDraftSpecialCategory } from "@/lib/advertising/draft-types";
import { useSelectOnFocus } from "@/hooks/use-select-on-focus";

import { BudgetFields } from "./budget-fields";
import { Hint, Section } from "./choice-row";
import { FieldIssues } from "./field-issues";
import { ObjectiveFields } from "./objective-fields";
import { useWizard } from "./wizard-context";

export function CampaignStep() {
  const t = useTranslations("adsWizard.campaign");
  const selectName = useSelectOnFocus();
  const { form, patch, update, account, issues } = useWizard();

  const toggleCampaignBudget = (on: boolean) => {
    update((current) => ({
      ...current,
      campaignBudgetOn: on,
      campaignBudget: on
        ? { ...current.campaignBudget, kind: current.adSetBudget.kind, input: current.campaignBudget.input || current.adSetBudget.input }
        : current.campaignBudget,
      adSetBid: on ? { ...current.adSetBid, strategy: LOWEST_COST } : current.adSetBid,
      campaignBid: on ? current.campaignBid : { ...current.campaignBid, strategy: LOWEST_COST },
    }));
  };

  return (
    <div className="space-y-6">
      <Section title={t("nameTitle")}>
        <ElevatedInput
          label={t("name")}
          value={form.campaignName}
          maxLength={MAX_NAME}
          onChange={(event) => patch({ campaignName: event.target.value })}
          {...selectName}
        />
        <Hint>{t("nameHint")}</Hint>
        <FieldIssues issues={issues} field="campaign.name" />
      </Section>

      <ObjectiveFields />

      <Section title={t("categoryTitle")} description={t("categoryDescription")}>
        <ElevatedSelect
          label={t("category")}
          value={form.specialCategory}
          onValueChange={(value) => update((current) => withSpecialCategory(current, value as AdDraftSpecialCategory))}
        >
          {SPECIAL_CATEGORIES.map((category) => (
            <ElevatedSelectItem key={category} value={category}>
              {t(`categories.${category}`)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
        <Hint>{t(`categoryHint.${form.specialCategory}`)}</Hint>
        {isRestrictedCategory(form.specialCategory) ? (
          <Hint tone="warning" icon={<Lock className="h-3.5 w-3.5" aria-hidden />}>
            {t("restrictedLock")}
          </Hint>
        ) : null}
        <Hint>{t("politicalNote")}</Hint>
        <FieldIssues issues={issues} field="campaign.specialCategory" />
      </Section>

      <Section title={t("budgetTitle")} description={t("budgetDescription")}>
        <ElevatedSwitch
          checked={form.campaignBudgetOn}
          onCheckedChange={toggleCampaignBudget}
          label={t("cbo")}
          description={t("cboHint")}
        />
        {form.campaignBudgetOn ? (
          <BudgetFields
            level="campaign"
            budget={form.campaignBudget}
            bid={form.campaignBid}
            goal={form.goal}
            currency={account?.currency ?? ""}
            issues={issues}
            onBudget={(campaignBudget) => patch({ campaignBudget })}
            onBid={(campaignBid) => patch({ campaignBid })}
          />
        ) : (
          <Hint>{t("budgetOnAdSet")}</Hint>
        )}
      </Section>
    </div>
  );
}
