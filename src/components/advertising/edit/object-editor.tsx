"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { isAdsError, updateAdObjectAction } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import { Image as ImageGlyph, Lock, PencilSimple, Warning } from "@/components/icons";
import { Hint, ReadOnlyFact, Section } from "@/components/advertising/wizard/choice-row";
import { useWizardLabels } from "@/components/advertising/wizard/use-wizard-labels";
import { useToast } from "@/hooks/use-toast";
import { civilToday } from "@/lib/advertising/date-range";
import { isArchived } from "@/lib/advertising/delivery";
import { bidFromInput } from "@/lib/advertising/draft";
import { buildObjectEdit, editExpected, editFormOf, editInputProblems, editIsEmpty, type EditForm } from "@/lib/advertising/edit";
import { issuesUnder, type ExpectedIssues } from "@/lib/advertising/issues";
import type { AdAccount, AdEditableObject, AdRow } from "@/lib/advertising/types";

import { AdImage } from "../ad-image";
import { useBudgetMinimum } from "../budget-minimum";
import { FooterSlot } from "../editor/editor-footer";
import { IssueList } from "../field-issue";
import { ObjectEditFields } from "./object-edit-fields";

export function ObjectEditForm({
  detail,
  account,
  catalog,
  canUpdate,
  onSaved,
  onSwapCreative,
  actionsSlot,
}: {
  detail: AdEditableObject;
  account: AdAccount;
  catalog: Record<string, string[]>;
  canUpdate: boolean;
  onSaved: (row: AdRow) => void;
  onSwapCreative?: () => void;
  actionsSlot?: HTMLElement | null;
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

  const locked = isArchived(row);
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
    <div className="space-y-4">
      <div className="space-y-4">
        {locked ? (
          <Hint tone="warning" icon={<Lock className="h-3.5 w-3.5" aria-hidden />}>
            {t("locked")}
          </Hint>
        ) : null}

        <ObjectEditFields
          idKey={row.metaId}
          level={row.level}
          form={form}
          update={update}
          disabled={disabled}
          problems={problems}
          expected={expected}
          account={account}
          catalog={catalog}
          goal={row.optimizationGoal ?? ""}
          destination={row.destinationType ?? ""}
          minimum={minimum}
          today={today}
          lifetime={lifetime}
          scheduleCleared={original.schedule.length > 0 && form.schedule.length === 0}
          basics={
            <>
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
            </>
          }
        />

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
            {canUpdate && !locked && onSwapCreative ? (
              <button
                type="button"
                onClick={onSwapCreative}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary-ink hover:underline"
              >
                <PencilSimple className="h-3.5 w-3.5" aria-hidden />
                {t("swapCreative")}
              </button>
            ) : null}
            <IssueList namespace="adsManager" issues={issuesUnder(expected, "creative")} />
          </Section>
        ) : null}
      </div>

      <FooterSlot slot={actionsSlot}>
      <div className="flex flex-wrap items-center justify-end gap-2">
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
      </FooterSlot>
    </div>
  );
}
