"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import ElevatedDatePicker from "@/components/elevated-design/elevated-date-picker";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { Hint, Section } from "@/components/advertising/wizard/choice-row";
import { ScheduleGrid } from "@/components/advertising/wizard/schedule-grid";
import { dayToLocalDate } from "@/lib/advertising/date-range";
import { editGroupsFor, type EditForm, type EditGroup, type EditInputProblem } from "@/lib/advertising/edit";
import { issuesUnder, type ExpectedIssues } from "@/lib/advertising/issues";
import type { AdAccount, AdBudgetMinimum, AdLevel } from "@/lib/advertising/types";

import { IssueList } from "../field-issue";
import { BudgetBidFields } from "./budget-bid-fields";
import { PlacementsFields } from "./placements-fields";
import { TargetingFields } from "./targeting-fields";

export type FieldSlot = (group: EditGroup, input: ReactNode) => ReactNode;

const PLAIN_SLOT: FieldSlot = (_group, input) => input;

export function ObjectEditFields({
  idKey,
  level,
  form,
  update,
  disabled,
  problems,
  expected,
  account,
  catalog,
  goal,
  destination,
  minimum,
  today,
  lifetime,
  scheduleCleared,
  basics,
  slot = PLAIN_SLOT,
}: {
  idKey: string;
  level: AdLevel;
  form: EditForm;
  update: (changes: Partial<EditForm>) => void;
  disabled: boolean;
  problems: EditInputProblem[];
  expected: ExpectedIssues;
  account: AdAccount;
  catalog: Record<string, string[]>;
  goal: string;
  destination: string;
  minimum: AdBudgetMinimum | null;
  today: string;
  lifetime: boolean;
  scheduleCleared: boolean;
  basics?: ReactNode;
  slot?: FieldSlot;
}) {
  const t = useTranslations("adsManager.edit");
  const groups = editGroupsFor(level);

  return (
    <>
      <Section title={t("basics")}>
        {slot(
          "name",
          <>
            <ElevatedInput
              label={t("name")}
              value={form.name}
              disabled={disabled}
              maxLength={400}
              onChange={(event) => update({ name: event.target.value })}
              error={problems.includes("name") ? t("nameRequired") : undefined}
              controlSize="sm"
            />
            <IssueList namespace="adsManager" issues={issuesUnder(expected, "name")} />
          </>,
        )}
        {basics}
      </Section>

      {groups.includes("budgetBid") && form.bid ? (
        <Section title={t("budgetTitle")}>
          {slot(
            "budgetBid",
            <BudgetBidFields
              level={level === "campaign" ? "campaign" : "adset"}
              budget={form.budget}
              bid={form.bid}
              goal={goal}
              currency={account.currency}
              expected={expected}
              minimum={minimum}
              disabled={disabled}
              onBudget={(budget) => update({ budget })}
              onBid={(bid) => update({ bid })}
            />,
          )}
        </Section>
      ) : null}

      {groups.includes("endDay") ? (
        <Section title={t("scheduleTitle")}>
          {slot(
            "endDay",
            <>
              <div className="max-w-xs">
                <ElevatedDatePicker
                  id={`ads-edit-end-${idKey}`}
                  label={t("endDay")}
                  value={form.endDay}
                  disabled={disabled}
                  minDate={dayToLocalDate(today) ?? undefined}
                  onChange={(endDay) => update({ endDay })}
                />
              </div>
              <Hint>{t("endDayHint", { timezone: account.timezone })}</Hint>
              <IssueList namespace="adsManager" issues={issuesUnder(expected, "endAt")} />
            </>,
          )}
          {lifetime ? (
            slot(
              "schedule",
              <>
                <fieldset disabled={disabled} className="min-w-0">
                  <ScheduleGrid value={form.schedule} onChange={(schedule) => update({ schedule })} />
                </fieldset>
                {scheduleCleared ? <Hint tone="warning">{t("scheduleKeep")}</Hint> : null}
              </>,
            )
          ) : (
            <Hint>{t("scheduleNeedsLifetime")}</Hint>
          )}
          <IssueList namespace="adsManager" issues={issuesUnder(expected, "schedule")} />
        </Section>
      ) : null}

      {groups.includes("targeting") && form.targeting ? (
        <Section title={t("audienceTitle")}>
          {slot(
            "targeting",
            <fieldset disabled={disabled} className="min-w-0">
              <TargetingFields
                accountId={account.id}
                targeting={form.targeting}
                expected={expected}
                onChange={(targeting) => update({ targeting })}
              />
            </fieldset>,
          )}
        </Section>
      ) : null}

      {groups.includes("placements") && form.placements ? (
        <Section title={t("placementsTitle")}>
          {slot(
            "placements",
            <fieldset disabled={disabled} className="min-w-0">
              <PlacementsFields
                placements={form.placements}
                catalog={catalog}
                destination={destination}
                expected={expected}
                onChange={(placements) => update({ placements })}
              />
            </fieldset>,
          )}
        </Section>
      ) : null}
    </>
  );
}
