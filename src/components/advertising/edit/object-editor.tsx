"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { getAdEditableObjectAction, isAdsError, updateAdObjectAction } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import ElevatedDatePicker from "@/components/elevated-design/elevated-date-picker";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ArrowSquareOut, Image as ImageGlyph, Lock, Warning } from "@/components/icons";
import { Hint, ReadOnlyFact, Section } from "@/components/advertising/wizard/choice-row";
import { ScheduleGrid } from "@/components/advertising/wizard/schedule-grid";
import { useAdsResource } from "@/components/advertising/wizard/use-ads-resource";
import { useWizardLabels } from "@/components/advertising/wizard/use-wizard-labels";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/routing";
import { wizardHref } from "@/lib/advertising/connect";
import { civilToday } from "@/lib/advertising/date-range";
import { bidFromInput } from "@/lib/advertising/draft";
import { buildObjectEdit, editExpected, editFormOf, editInputProblems, editIsEmpty, type EditForm } from "@/lib/advertising/edit";
import { issuesUnder, type ExpectedIssues } from "@/lib/advertising/issues";
import type { AdAccount, AdEditableObject, AdRow } from "@/lib/advertising/types";

import { AdImage } from "../ad-image";
import { useBudgetMinimum } from "../budget-minimum";
import { IssueList } from "../field-issue";
import { BudgetBidFields } from "./budget-bid-fields";
import { PlacementsFields } from "./placements-fields";
import { TargetingFields } from "./targeting-fields";

function isLocked(row: AdRow): boolean {
  return ["ARCHIVED", "DELETED"].includes(row.status) || ["ARCHIVED", "DELETED"].includes(row.effectiveStatus);
}

function dayDate(day: string): Date | undefined {
  return day ? new Date(`${day}T00:00:00`) : undefined;
}

function EditorForm({
  detail,
  account,
  catalog,
  canUpdate,
  onSaved,
}: {
  detail: AdEditableObject;
  account: AdAccount;
  catalog: Record<string, string[]>;
  canUpdate: boolean;
  onSaved: (row: AdRow) => void;
}) {
  const t = useTranslations("adsManager.edit");
  const labels = useWizardLabels();
  const { toast } = useToast();
  const { row } = detail;
  const currency = account.currency;
  const [original] = useState<EditForm>(() => editFormOf(detail, account.timezone, catalog, currency));
  const [form, setForm] = useState<EditForm>(original);
  const [today] = useState(() => civilToday(account.timezone, new Date()) ?? "");
  const [saving, setSaving] = useState(false);
  const [expected, setExpected] = useState<ExpectedIssues>({});
  const [error, setError] = useState<string | null>(null);

  const locked = isLocked(row);
  const disabled = locked || !canUpdate || saving;
  const edit = buildObjectEdit(original, form, account.timezone, currency);
  const problems = editInputProblems(form, currency);
  const lifetime = form.budget?.kind === "LIFETIME";
  const minimum = useBudgetMinimum(
    canUpdate && row.level === "adset" && row.optimizationGoal && form.budget?.kind === "DAILY" && form.bid
      ? { accountId: account.id, goal: row.optimizationGoal, bidAmount: bidFromInput(form.bid, currency).amount ?? 0 }
      : null,
  );

  const update = (changes: Partial<EditForm>) => setForm((current) => ({ ...current, ...changes }));

  const save = () => {
    setSaving(true);
    setError(null);
    setExpected({});
    void updateAdObjectAction(row.metaId, edit).then((result) => {
      setSaving(false);
      if (isAdsError(result)) {
        const issues = editExpected(result.expected);
        setExpected(issues);
        setError(Object.keys(issues).length > 0 ? t("fixIssues") : result.status === 429 ? t("tooSoon") : result.error);
        return;
      }
      toast({ title: t("saved", { name: result.data.name }) });
      onSaved(result.data);
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
        {locked ? (
          <Hint tone="warning" icon={<Lock className="h-3.5 w-3.5" aria-hidden />}>
            {t("locked")}
          </Hint>
        ) : null}

        <Section title={t("basics")}>
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
          <dl>
            {row.objective ? <ReadOnlyFact label={t("objective")} value={labels.objective(row.objective)} /> : null}
            {row.level === "adset" && row.optimizationGoal ? (
              <ReadOnlyFact label={t("goal")} value={labels.goal(row.optimizationGoal)} />
            ) : null}
            {row.level === "adset" && row.destinationType ? (
              <ReadOnlyFact label={t("destination")} value={labels.destination(row.destinationType)} />
            ) : null}
          </dl>
          {row.level === "adset" && row.optimizationGoal ? (
            <Hint icon={<Lock className="h-3.5 w-3.5" aria-hidden />}>{t("goalLocked")}</Hint>
          ) : null}
        </Section>

        {form.bid && row.level !== "ad" ? (
          <Section title={t("budgetTitle")}>
            <BudgetBidFields
              level={row.level === "campaign" ? "campaign" : "adset"}
              budget={form.budget}
              bid={form.bid}
              goal={row.optimizationGoal ?? ""}
              currency={currency}
              expected={expected}
              minimum={minimum}
              disabled={disabled}
              onBudget={(budget) => update({ budget })}
              onBid={(bid) => update({ bid })}
            />
          </Section>
        ) : null}

        {row.level === "adset" ? (
          <Section title={t("scheduleTitle")}>
            <div className="max-w-xs">
              <ElevatedDatePicker
                id={`ads-edit-end-${row.metaId}`}
                label={t("endDay")}
                value={form.endDay}
                disabled={disabled}
                minDate={dayDate(today)}
                onChange={(endDay) => update({ endDay })}
              />
            </div>
            <Hint>{t("endDayHint", { timezone: account.timezone })}</Hint>
            <IssueList namespace="adsManager" issues={issuesUnder(expected, "endAt")} />
            {lifetime ? (
              <>
                <fieldset disabled={disabled} className="min-w-0">
                  <ScheduleGrid value={form.schedule} onChange={(schedule) => update({ schedule })} />
                </fieldset>
                {original.schedule.length > 0 && form.schedule.length === 0 ? <Hint tone="warning">{t("scheduleKeep")}</Hint> : null}
              </>
            ) : (
              <Hint>{t("scheduleNeedsLifetime")}</Hint>
            )}
            <IssueList namespace="adsManager" issues={issuesUnder(expected, "schedule")} />
          </Section>
        ) : null}

        {form.targeting ? (
          <Section title={t("audienceTitle")}>
            <fieldset disabled={disabled} className="min-w-0">
              <TargetingFields accountId={account.id} targeting={form.targeting} expected={expected} onChange={(targeting) => update({ targeting })} />
            </fieldset>
          </Section>
        ) : null}

        {form.placements ? (
          <Section title={t("placementsTitle")}>
            <fieldset disabled={disabled} className="min-w-0">
              <PlacementsFields
                placements={form.placements}
                catalog={catalog}
                destination={row.destinationType ?? ""}
                expected={expected}
                onChange={(placements) => update({ placements })}
              />
            </fieldset>
          </Section>
        ) : null}

        {row.level === "ad" ? (
          <Section title={t("creativeTitle")}>
            <div className="flex items-start gap-3 rounded-[--radius] border border-border p-3">
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[--radius] bg-muted">
                {row.creative?.thumbnailUrl || row.creative?.imageUrl ? (
                  <AdImage src={row.creative.thumbnailUrl || row.creative.imageUrl || ""} />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageGlyph className="h-5 w-5" aria-hidden />
                  </span>
                )}
              </span>
              <div className="min-w-0 space-y-1 text-sm">
                {row.creative?.title ? <p className="font-medium text-foreground">{row.creative.title}</p> : null}
                {row.creative?.body ? <p className="line-clamp-3 text-muted-foreground">{row.creative.body}</p> : null}
              </div>
            </div>
            {canUpdate && !locked ? (
              <Link
                href={wizardHref({ accountId: account.id, adId: row.metaId })}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary-ink hover:underline"
              >
                {t("swapCreative")}
                <ArrowSquareOut className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : null}
            <IssueList namespace="adsManager" issues={issuesUnder(expected, "creative")} />
          </Section>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-3">
        {error ? (
          <p className="mr-auto flex items-center gap-1.5 text-sm text-destructive-ink" role="alert">
            <Warning className="h-4 w-4" aria-hidden />
            {error}
          </p>
        ) : null}
        <Button variant="ghost" size="sm" title={t("discard")} onClick={() => setForm(original)} disabled={saving || editIsEmpty(edit)} />
        <Button
          variant="primary"
          size="sm"
          title={saving ? t("saving") : t("save")}
          onClick={save}
          disabled={disabled || problems.length > 0 || editIsEmpty(edit)}
        />
      </div>
    </div>
  );
}

export function ObjectEditor({
  metaId,
  account,
  catalog,
  canUpdate,
  onSaved,
}: {
  metaId: string;
  account: AdAccount;
  catalog: Record<string, string[]>;
  canUpdate: boolean;
  onSaved: (row: AdRow) => void;
}) {
  const t = useTranslations("adsManager.edit");
  const detail = useAdsResource(`object:${metaId}`, () => getAdEditableObjectAction(metaId));

  if (detail.status === "error") {
    return (
      <div className="flex items-center gap-2 px-6 text-sm text-destructive-ink">
        <Warning className="h-4 w-4" aria-hidden />
        {detail.message}
        <button type="button" onClick={detail.reload} className="ml-auto font-semibold text-primary-ink hover:underline">
          {t("retry")}
        </button>
      </div>
    );
  }

  if (detail.status !== "ready") {
    return (
      <div className="space-y-3 px-6">
        <div className="h-10 animate-pulse rounded-[--radius] bg-muted" />
        <div className="h-24 animate-pulse rounded-[--radius] bg-muted" />
      </div>
    );
  }

  return (
    <EditorForm
      key={detail.data.row.metaId}
      detail={detail.data}
      account={account}
      catalog={catalog}
      canUpdate={canUpdate}
      onSaved={(row) => {
        onSaved(row);
        detail.reload();
      }}
    />
  );
}
