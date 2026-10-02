"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { createRuleAction } from "@/app/actions/advertising-rules";
import { getAdsReportAction, isAdsError, type AdsResult } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSegmentedControl } from "@/components/elevated-design/elevated-segmented-control";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { Lightning, Plus, X } from "@/components/icons";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import { civilToday, rangeForPreset } from "@/lib/advertising/date-range";
import { issuesAt, issuesUnder, type ExpectedIssues } from "@/lib/advertising/issues";
import {
  MAX_RULE_CONDITIONS,
  RULE_ENTITIES,
  RULE_FREQUENCIES,
  RULE_METRICS,
  RULE_OPERATORS,
  RULE_WINDOWS,
  buildRule,
  choicesFor,
  emptyRuleBuilder,
  isBudgetChoice,
  metricUnit,
  previewRule,
  withEntity,
  type ConditionDraft,
  type RuleActionChoice,
  type RuleBuilderState,
  type RuleEntity,
  type RuleFrequency,
  type RuleMetric,
  type RuleOperator,
  type RuleWindow,
} from "@/lib/advertising/rules";
import type { AdAccount, AdLevel, AdReport } from "@/lib/advertising/types";

import { IssueList } from "../field-issue";
import { IconAction } from "../icon-action";
import { Section } from "../wizard/choice-row";
import { useRuleSentence } from "./use-rule-sentence";

const LEVEL_OF: Record<RuleEntity, AdLevel> = { CAMPAIGN: "campaign", ADSET: "adset", AD: "ad" };

async function loadObjects(account: AdAccount, entity: RuleEntity): Promise<AdsResult<AdReport> | null> {
  const today = civilToday(account.timezone, new Date());
  if (!today) return null;
  return getAdsReportAction(account.id, { level: LEVEL_OF[entity], range: rangeForPreset("last30", today) });
}

export function RuleBuilderDialog({
  account,
  onClose,
  onCreated,
}: {
  account: AdAccount;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const t = useTranslations("adsRules.builder");
  const tr = useTranslations("adsRules");
  const sentence = useRuleSentence(account.currency);
  const [state, setState] = useState<RuleBuilderState>(emptyRuleBuilder);
  const [expected, setExpected] = useState<ExpectedIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const objectsKey = state.scope === "chosen" ? state.entity : null;
  const load = useCallback(() => loadObjects(account, state.entity), [account, state.entity]);
  const objects = useKeyedLoad(objectsKey, load);
  const report = objects.value;
  const rows = report && !isAdsError(report) ? (report.data.rows ?? []) : [];

  const built = buildRule(state, account.id, account.currency);
  const showLocal = checked && !built.rule;
  const patch = (change: Partial<RuleBuilderState>) => setState((current) => ({ ...current, ...change }));
  const patchCondition = (index: number, change: Partial<ConditionDraft>) =>
    setState((current) => ({
      ...current,
      conditions: current.conditions.map((condition, position) => (position === index ? { ...condition, ...change } : condition)),
    }));

  const toggleObject = (metaId: string) =>
    setState((current) => ({
      ...current,
      objectIds: current.objectIds.includes(metaId) ? current.objectIds.filter((id) => id !== metaId) : [...current.objectIds, metaId],
    }));

  const submit = async () => {
    setChecked(true);
    if (!built.rule) return;
    setSaving(true);
    setFailure(null);
    const outcome = await createRuleAction(built.rule);
    setSaving(false);
    if (isAdsError(outcome)) {
      setExpected(outcome.expected ?? {});
      setFailure(outcome.expected ? null : outcome.error);
      return;
    }
    onCreated(built.rule.name);
  };

  const unitHint = (metric: RuleMetric) => {
    const unit = metricUnit(metric);
    if (unit === "money") return account.currency;
    if (unit === "percent") return "%";
    return undefined;
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && onClose()}>
      <ElevatedDialogContent className="max-w-3xl">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-6">
          <div className="space-y-1">
            <ElevatedInput label={t("name")} placeholder=" " value={state.name} onChange={(event) => patch({ name: event.target.value })} />
            <IssueList namespace="adsRules" issues={issuesAt(expected, "name")} />
          </div>

          <Section title={t("appliesTitle")}>
            <ElevatedSegmentedControl
              options={RULE_ENTITIES.map((entity) => ({ value: entity, label: tr(`entities.${entity}`) }))}
              value={state.entity}
              onChange={(value) => setState((current) => withEntity(current, value as RuleEntity))}
              size="sm"
              columns={3}
            />
            <ElevatedSegmentedControl
              options={[
                { value: "all", label: tr(`appliesAll.${state.entity}`) },
                { value: "chosen", label: t("chooseObjects") },
              ]}
              value={state.scope}
              onChange={(value) => patch({ scope: value === "chosen" ? "chosen" : "all", objectIds: [] })}
              size="sm"
              columns={2}
            />
            {state.scope === "all" ? <p className="text-xs text-muted-foreground">{t("allHint")}</p> : null}
            {state.scope === "chosen" ? (
              <div className="max-h-56 overflow-y-auto rounded-[--radius] border border-border">
                {objects.loading ? <div className="h-20 animate-pulse bg-muted" /> : null}
                {report === null && !objects.loading ? <p className="px-3 py-2.5 text-sm text-destructive-ink">{t("objectsTimezone")}</p> : null}
                {report && isAdsError(report) ? <p className="px-3 py-2.5 text-sm text-destructive-ink">{report.error}</p> : null}
                {!objects.loading && report && !isAdsError(report) && rows.length === 0 ? (
                  <p className="px-3 py-2.5 text-sm text-muted-foreground">{t("noObjects")}</p>
                ) : null}
                <ul className="divide-y divide-border">
                  {rows.map((row) => (
                    <li key={row.metaId}>
                      <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted">
                        <Checkbox checked={state.objectIds.includes(row.metaId)} onCheckedChange={() => toggleObject(row.metaId)} />
                        <span className="min-w-0 flex-1 truncate text-foreground">{row.name}</span>
                        <span className="text-2xs text-muted-foreground">{row.isOn ? t("on") : t("off")}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {showLocal && built.missingObjects ? <p className="text-xs text-destructive-ink">{t("needsObjects")}</p> : null}
            <IssueList namespace="adsRules" issues={[...issuesAt(expected, "entity"), ...issuesAt(expected, "objectIds")]} />
          </Section>

          <Section title={t("conditionsTitle")} description={t("conditionsDescription")}>
            <ol className="space-y-2">
              {state.conditions.map((condition, index) => (
                <li key={index} className="space-y-1">
                  <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                    <ElevatedSelect
                      value={condition.metric}
                      onValueChange={(value) => patchCondition(index, { metric: value as RuleMetric })}
                      aria-label={t("metric")}
                    >
                      {RULE_METRICS.map((metric) => (
                        <ElevatedSelectItem key={metric} value={metric}>
                          {tr(`metrics.${metric}`)}
                        </ElevatedSelectItem>
                      ))}
                    </ElevatedSelect>
                    <ElevatedSelect
                      value={condition.operator}
                      onValueChange={(value) => patchCondition(index, { operator: value as RuleOperator })}
                      aria-label={t("operator")}
                    >
                      {RULE_OPERATORS.map((operator) => (
                        <ElevatedSelectItem key={operator} value={operator}>
                          {tr(`operators.${operator}`)}
                        </ElevatedSelectItem>
                      ))}
                    </ElevatedSelect>
                    <ElevatedInput
                      placeholder={unitHint(condition.metric) ?? t("value")}
                      aria-label={t("value")}
                      inputMode="decimal"
                      value={condition.raw}
                      onChange={(event) => patchCondition(index, { raw: event.target.value })}
                      error={showLocal && built.invalidConditions.includes(index) ? t("invalidValue") : undefined}
                    />
                    <IconAction
                      label={t("removeCondition")}
                      onClick={() => setState((current) => ({ ...current, conditions: current.conditions.filter((_, position) => position !== index) }))}
                      disabled={state.conditions.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </IconAction>
                  </div>
                  <IssueList namespace="adsRules" issues={issuesUnder(expected, `conditions[${index}]`)} />
                </li>
              ))}
            </ol>
            <IssueList namespace="adsRules" issues={issuesAt(expected, "conditions")} />
            <button
              type="button"
              disabled={state.conditions.length >= MAX_RULE_CONDITIONS}
              onClick={() =>
                setState((current) => ({
                  ...current,
                  conditions: [...current.conditions, { metric: "spent", operator: "GREATER_THAN", raw: "" }],
                }))
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-ink hover:underline disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t("addCondition")}
            </button>
            <div className="max-w-xs">
              <ElevatedSelect label={t("window")} value={state.window} onValueChange={(value) => patch({ window: value as RuleWindow })}>
                {RULE_WINDOWS.map((window) => (
                  <ElevatedSelectItem key={window} value={window}>
                    {tr(`windows.${window}`)}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
            </div>
          </Section>

          <Section title={t("actionTitle")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <ElevatedSelect label={t("action")} value={state.action} onValueChange={(value) => patch({ action: value as RuleActionChoice })}>
                {choicesFor(state.entity).map((choice) => (
                  <ElevatedSelectItem key={choice} value={choice}>
                    {tr(`actionChoices.${choice}`)}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
              {isBudgetChoice(state.action) ? (
                <ElevatedInput
                  label={t("percent")}
                  placeholder=" "
                  inputMode="numeric"
                  value={state.percent}
                  onChange={(event) => patch({ percent: event.target.value })}
                  error={showLocal && built.invalidPercent ? t("invalidPercent") : undefined}
                />
              ) : null}
            </div>
            <IssueList namespace="adsRules" issues={issuesUnder(expected, "action")} />
            <div className="max-w-xs">
              <ElevatedSelect label={t("frequency")} value={state.frequency} onValueChange={(value) => patch({ frequency: value as RuleFrequency })}>
                {RULE_FREQUENCIES.map((frequency) => (
                  <ElevatedSelectItem key={frequency} value={frequency}>
                    {tr(`frequencies.${frequency}`)}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
            </div>
            <IssueList namespace="adsRules" issues={[...issuesAt(expected, "window"), ...issuesAt(expected, "frequency")]} />
          </Section>

          <div className="flex items-start gap-2.5 rounded-[--radius] border border-border bg-muted px-3 py-2.5">
            <Lightning className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t("previewTitle")}</p>
              <p className="text-sm text-foreground">{sentence(previewRule(state, account.currency))}</p>
            </div>
          </div>
          {failure ? <p className="text-sm text-destructive-ink">{failure}</p> : null}
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("cancel")} onClick={onClose} />
          <Button variant="primary" title={saving ? t("creating") : t("create")} onClick={submit} disabled={saving} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
