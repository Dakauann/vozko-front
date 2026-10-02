"use client";

import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { Lock } from "@/components/icons";
import { Hint, ReadOnlyFact } from "@/components/advertising/wizard/choice-row";
import { bidStrategiesFor, parseRoas, type BidInput, type BudgetInput } from "@/lib/advertising/draft";
import type { AdBidStrategy, AdOptimizationGoal } from "@/lib/advertising/draft-types";
import { issuesUnder, withBudgetMinimum, type ExpectedIssues } from "@/lib/advertising/issues";
import { inputToMinor } from "@/lib/advertising/money";
import type { AdBudgetMinimum } from "@/lib/advertising/types";

import { BudgetMinimumHint } from "../budget-minimum";
import { IssueList } from "../field-issue";

export function BudgetBidFields({
  level,
  budget,
  bid,
  goal,
  currency,
  expected,
  minimum = null,
  disabled,
  onBudget,
  onBid,
}: {
  level: "campaign" | "adset";
  budget: BudgetInput | null;
  bid: BidInput;
  goal: string;
  currency: string;
  expected: ExpectedIssues;
  minimum?: AdBudgetMinimum | null;
  disabled: boolean;
  onBudget: (budget: BudgetInput) => void;
  onBid: (bid: BidInput) => void;
}) {
  const t = useTranslations("adsManager.edit.budget");
  const offered = bidStrategiesFor(level === "campaign" ? "campaign" : "adSet", goal as AdOptimizationGoal);
  const strategies = offered.includes(bid.strategy) ? offered : [...offered, bid.strategy];
  const needsAmount = bid.strategy === "LOWEST_COST_WITH_BID_CAP" || bid.strategy === "COST_CAP";
  const needsRoas = bid.strategy === "LOWEST_COST_WITH_MIN_ROAS";

  return (
    <div className="space-y-3">
      {budget ? (
        <>
          <dl>
            <ReadOnlyFact label={t("kind")} value={t(`kinds.${budget.kind}`)} />
          </dl>
          <Hint icon={<Lock className="h-3.5 w-3.5" aria-hidden />}>{t("kindLocked")}</Hint>
          <ElevatedInput
            label={t(`amount.${budget.kind}`, { currency })}
            inputMode="decimal"
            value={budget.input}
            disabled={disabled}
            onChange={(event) => onBudget({ ...budget, input: event.target.value })}
            error={budget.input.trim() !== "" && inputToMinor(budget.input, currency) === null ? t("invalid") : undefined}
            controlSize="sm"
          />
          {budget.kind === "DAILY" ? <BudgetMinimumHint minimum={minimum} /> : null}
          <Hint>{t("limitHint")}</Hint>
        </>
      ) : (
        <Hint>{t(level === "campaign" ? "onAdSets" : "onCampaign")}</Hint>
      )}
      <IssueList namespace="adsManager" issues={withBudgetMinimum(issuesUnder(expected, "budget"), minimum)} />

      <ElevatedSelect
        label={t("strategy")}
        value={bid.strategy}
        disabled={disabled}
        onValueChange={(value) => onBid({ ...bid, strategy: value as AdBidStrategy })}
      >
        {strategies.map((strategy) => (
          <ElevatedSelectItem key={strategy} value={strategy}>
            {t(`strategies.${strategy}`)}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
      {needsAmount ? (
        <ElevatedInput
          label={t(bid.strategy === "COST_CAP" ? "costCap" : "bidCap", { currency })}
          inputMode="decimal"
          value={bid.amountInput}
          disabled={disabled}
          onChange={(event) => onBid({ ...bid, amountInput: event.target.value })}
          error={bid.amountInput.trim() !== "" && inputToMinor(bid.amountInput, currency) === null ? t("invalid") : undefined}
          controlSize="sm"
        />
      ) : null}
      {needsRoas ? (
        <ElevatedInput
          label={t("roasFloor")}
          inputMode="decimal"
          value={bid.roasInput}
          disabled={disabled}
          onChange={(event) => onBid({ ...bid, roasInput: event.target.value })}
          error={bid.roasInput.trim() !== "" && parseRoas(bid.roasInput) === null ? t("roasInvalid") : undefined}
          controlSize="sm"
        />
      ) : null}
      <IssueList namespace="adsManager" issues={issuesUnder(expected, "bid")} />
    </div>
  );
}
