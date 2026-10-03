"use client";

import { useTranslations } from "next-intl";

import { ChatsCircle, CursorClick, DeviceMobile, Megaphone, Storefront, UserPlus, type Icon } from "@/components/icons";
import { RadioGroup } from "@/components/ui/radio-group";
import { withObjective } from "@/lib/advertising/draft";
import type { AdObjective } from "@/lib/advertising/draft-types";
import { OBJECTIVES, routesFor } from "@/lib/advertising/wizard-routes";

import { ChoiceRow, ReadOnlyFact, Section } from "./choice-row";
import { FieldIssues } from "./field-issues";
import { useWizard } from "./wizard-context";

export const OBJECTIVE_ICONS: Record<AdObjective, Icon> = {
  OUTCOME_AWARENESS: Megaphone,
  OUTCOME_TRAFFIC: CursorClick,
  OUTCOME_ENGAGEMENT: ChatsCircle,
  OUTCOME_LEADS: UserPlus,
  OUTCOME_SALES: Storefront,
  OUTCOME_APP_PROMOTION: DeviceMobile,
};

export function ObjectiveFields() {
  const t = useTranslations("adsWizard.objective");
  const tCreate = useTranslations("adsCreate");
  const { form, update, options, issues } = useWizard();

  const chooseObjective = (value: string) => {
    const objective = value as AdObjective;
    update((current) => withObjective(current, objective, routesFor(options, objective)));
  };

  return (
    <Section title={t("title")} description={t("description")}>
      <dl>
        <ReadOnlyFact label={tCreate("buyingType")} value={tCreate("auction")} />
      </dl>
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
      <FieldIssues issues={issues} field="adAccountId" />
    </Section>
  );
}
