"use client";

import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { bidStrategiesFor, parseRoas, type BidInput, type BudgetInput } from "@/lib/advertising/draft";
import type { AdBidStrategy, AdBudgetKind, AdOptimizationGoal } from "@/lib/advertising/draft-types";
import { inputToMinor } from "@/lib/advertising/money";
import type { DraftIssue } from "@/lib/advertising/wizard-issues";

import { useAdsFormat } from "../use-ads-format";
import { Hint } from "./choice-row";
import { FieldIssues } from "./field-issues";

const KINDS: AdBudgetKind[] = ["DAILY", "LIFETIME"];

export function BudgetFields({
  level,
  budget,
  bid,
  goal,
  currency,
  issues,
  onBudget,
  onBid,
}: {
  level: "campaign" | "adSet";
  budget: BudgetInput;
  bid: BidInput;
  goal: AdOptimizationGoal | "";
  currency: string;
  issues: DraftIssue[];
  onBudget: (budget: BudgetInput) => void;
  onBid: (bid: BidInput) => void;
}) {
  const t = useTranslations("adsWizard.budget");
  const fmt = useAdsFormat();
  const minor = inputToMinor(budget.input, currency);
  const invalid = budget.input.trim() !== "" && minor === null;
  const strategies = bidStrategiesFor(level, goal);
  const strategy = bid.strategy;
  const needsAmount = strategy === "LOWEST_COST_WITH_BID_CAP" || strategy === "COST_CAP";
  const bidMinor = inputToMinor(bid.amountInput, currency);

  return (
    <div className="space-y-3">
      <ElevatedPillToggle<AdBudgetKind>
        size="sm"
        value={budget.kind}
        onChange={(kind) => onBudget({ ...budget, kind })}
        options={KINDS.map((kind) => ({ value: kind, label: t(`kind.${kind}`) }))}
      />
      <Hint>{t(`kindHint.${budget.kind}`)}</Hint>
      <ElevatedInput
        label={t(`amount.${budget.kind}`, { currency })}
        inputMode="decimal"
        value={budget.input}
        onChange={(event) => onBudget({ ...budget, input: event.target.value })}
        error={invalid ? t("invalid") : undefined}
      />
      {minor !== null ? (
        <p className="text-xs tabular-nums text-muted-foreground">
          {budget.kind === "DAILY"
            ? t("dailyPreview", { amount: fmt.minor(minor, currency), monthly: fmt.minor(minor * 30, currency) })
            : t("lifetimePreview", { amount: fmt.minor(minor, currency) })}
        </p>
      ) : null}
      <FieldIssues issues={issues} field={`${level}.budget`} nested />

      <ElevatedSelect label={t("strategy")} value={strategy} onValueChange={(value) => onBid({ ...bid, strategy: value as AdBidStrategy })}>
        {strategies.map((candidate) => (
          <ElevatedSelectItem key={candidate} value={candidate}>
            {t(`strategies.${candidate}`)}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
      <Hint>{t(`strategyHint.${strategy}`)}</Hint>
      {needsAmount ? (
        <ElevatedInput
          label={t(strategy === "COST_CAP" ? "costCap" : "bidCap", { currency })}
          inputMode="decimal"
          value={bid.amountInput}
          onChange={(event) => onBid({ ...bid, amountInput: event.target.value })}
          error={bid.amountInput.trim() !== "" && bidMinor === null ? t("invalid") : undefined}
        />
      ) : null}
      {strategy === "LOWEST_COST_WITH_MIN_ROAS" ? (
        <ElevatedInput
          label={t("roasFloor")}
          inputMode="decimal"
          value={bid.roasInput}
          onChange={(event) => onBid({ ...bid, roasInput: event.target.value })}
          error={bid.roasInput.trim() !== "" && parseRoas(bid.roasInput) === null ? t("roasInvalid") : undefined}
        />
      ) : null}
      {strategy === "LOWEST_COST_WITH_MIN_ROAS" ? <Hint>{t("roasHint")}</Hint> : null}
      <FieldIssues issues={issues} field={`${level}.bid`} nested />
      <Hint>{t("billedByMeta")}</Hint>
    </div>
  );
}
