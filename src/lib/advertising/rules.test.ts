import { describe, expect, it } from "vitest";

import {
  actionChoiceOf,
  actionFromChoice,
  buildRule,
  emptyRuleBuilder,
  parsePercent,
  previewRule,
  withEntity,
  choicesFor,
  formatRuleValue,
  joinConditions,
  metricUnit,
  ruleSentence,
  ruleSentenceParts,
  ruleValueFromInput,
  ruleValueToInput,
  type AutomatedRule,
  type RuleWords,
} from "./rules";
import { EMPTY_VALUE } from "./money";

const plain = (value: string) => value.replace(/\s/g, " ");

describe("metric units", () => {
  it("knows which metrics are money", () => {
    expect(metricUnit("cost_per_result")).toBe("money");
    expect(metricUnit("cpm")).toBe("money");
    expect(metricUnit("ctr")).toBe("percent");
    expect(metricUnit("frequency")).toBe("ratio");
    expect(metricUnit("results")).toBe("count");
  });
});

describe("ruleValueFromInput", () => {
  it("reads money in the account currency as whole units", () => {
    expect(ruleValueFromInput("30", "cost_per_result", "BRL")).toBe(30);
    expect(ruleValueFromInput("12,50", "spent", "BRL")).toBe(12.5);
    expect(ruleValueFromInput("1.234,56", "spent", "BRL")).toBe(1234.56);
    expect(ruleValueFromInput("500", "cpc", "JPY")).toBe(500);
  });

  it("rejects empty or broken input", () => {
    expect(ruleValueFromInput("", "spent", "BRL")).toBeNull();
    expect(ruleValueFromInput("abc", "results", "BRL")).toBeNull();
    expect(ruleValueFromInput("10", "spent", "??")).toBeNull();
  });

  it("keeps decimals for ratios and rounds counts", () => {
    expect(ruleValueFromInput("2,5", "frequency", "BRL")).toBe(2.5);
    expect(ruleValueFromInput("1,25", "ctr", "BRL")).toBe(1.25);
    expect(ruleValueFromInput("10,6", "results", "BRL")).toBe(11);
    expect(ruleValueFromInput("0", "results", "BRL")).toBe(0);
    expect(ruleValueFromInput("10.000", "impressions", "BRL")).toBe(10000);
    expect(ruleValueFromInput("2.5", "frequency", "BRL")).toBe(2.5);
  });
});

describe("ruleValueToInput and formatRuleValue", () => {
  it("round trips money through the input format", () => {
    expect(ruleValueToInput(30, "cost_per_result", "BRL")).toBe("30,00");
    expect(ruleValueToInput(2.5, "frequency", "BRL")).toBe("2,5");
  });

  it("formats each unit for the sentence", () => {
    expect(plain(formatRuleValue(30, "cost_per_result", "BRL", "pt-BR"))).toBe("R$ 30,00");
    expect(formatRuleValue(1.5, "ctr", "BRL", "pt-BR")).toBe("1,50%");
    expect(formatRuleValue(1000, "impressions", "BRL", "pt-BR")).toBe("1.000");
    expect(formatRuleValue(2.25, "frequency", "BRL", "pt-BR")).toBe("2,25");
  });
});

describe("rule actions", () => {
  it("maps budget direction to the sign of the percent", () => {
    expect(actionFromChoice("INCREASE_BUDGET", 20)).toEqual({ type: "CHANGE_BUDGET", budgetPercent: 20 });
    expect(actionFromChoice("DECREASE_BUDGET", 20)).toEqual({ type: "CHANGE_BUDGET", budgetPercent: -20 });
    expect(actionFromChoice("DECREASE_BUDGET", 400)).toEqual({ type: "CHANGE_BUDGET", budgetPercent: -100 });
    expect(actionFromChoice("PAUSE", 20)).toEqual({ type: "PAUSE" });
    expect(actionChoiceOf({ type: "CHANGE_BUDGET", budgetPercent: -15 })).toBe("DECREASE_BUDGET");
    expect(actionChoiceOf({ type: "CHANGE_BUDGET", budgetPercent: 15 })).toBe("INCREASE_BUDGET");
  });

  it("does not offer budget changes for ads", () => {
    expect(choicesFor("AD")).toEqual(["PAUSE", "UNPAUSE"]);
    expect(choicesFor("ADSET")).toContain("DECREASE_BUDGET");
  });
});

describe("ruleSentence", () => {
  const words: RuleWords = {
    condition: (metric, window, operator, value) => `${metric}@${window} ${operator === "GREATER_THAN" ? ">" : "<"} ${value}`,
    and: "e",
    action: (choice, entity, percent) => `${choice}:${entity}:${percent}`,
    frequency: (frequency) => `[${frequency}]`,
    sentence: (conditions, action) => `Se ${conditions}, ${action}.`,
  };

  const rule: AutomatedRule = {
    adAccountId: "a",
    name: "r",
    status: "ENABLED",
    entity: "ADSET",
    conditions: [
      { metric: "cost_per_result", operator: "GREATER_THAN", value: 30 },
      { metric: "results", operator: "LESS_THAN", value: 2 },
    ],
    window: "TODAY",
    action: { type: "CHANGE_BUDGET", budgetPercent: -20 },
    frequency: "SEMI_HOURLY",
  };

  it("collects the parts with formatted values", () => {
    const parts = ruleSentenceParts(rule, "BRL", "pt-BR");
    expect(parts.scope).toBe("all");
    expect(parts.action).toBe("DECREASE_BUDGET");
    expect(parts.percent).toBe(20);
    expect(plain(parts.conditions[0].value)).toBe("R$ 30,00");
    expect(ruleSentenceParts({ ...rule, objectIds: ["1", "2"] }, "BRL", "pt-BR")).toMatchObject({ scope: "chosen", chosenCount: 2 });
  });

  it("builds one readable sentence", () => {
    expect(plain(ruleSentence(ruleSentenceParts(rule, "BRL", "pt-BR"), words))).toBe(
      "Se cost_per_result@TODAY > R$ 30,00 e results@TODAY < 2, DECREASE_BUDGET:ADSET:20. [SEMI_HOURLY]",
    );
  });

  it("joins three conditions with commas and a final and", () => {
    expect(joinConditions(["a", "b", "c"], "e")).toBe("a, b e c");
    expect(joinConditions([], "e")).toBe("");
  });
});

describe("rule builder", () => {
  it("builds the rule the API expects", () => {
    const state = { ...emptyRuleBuilder(), name: " Corta caro ", conditions: [{ metric: "cost_per_result" as const, operator: "GREATER_THAN" as const, raw: "30" }] };
    const built = buildRule(state, "acc", "BRL");
    expect(built.rule).toEqual({
      adAccountId: "acc",
      name: "Corta caro",
      status: "ENABLED",
      entity: "ADSET",
      objectIds: undefined,
      conditions: [{ metric: "cost_per_result", operator: "GREATER_THAN", value: 30 }],
      window: "TODAY",
      action: { type: "PAUSE" },
      frequency: "SEMI_HOURLY",
    });
  });

  it("reports what is missing instead of building", () => {
    const state = { ...emptyRuleBuilder(), scope: "chosen" as const, action: "DECREASE_BUDGET" as const, percent: "0" };
    const built = buildRule(state, "acc", "BRL");
    expect(built.rule).toBeNull();
    expect(built.invalidConditions).toEqual([0]);
    expect(built.invalidPercent).toBe(true);
    expect(built.missingObjects).toBe(true);
  });

  it("sends a negative percent to decrease the budget", () => {
    const state = { ...emptyRuleBuilder(), action: "DECREASE_BUDGET" as const, percent: "15", conditions: [{ metric: "spent" as const, operator: "GREATER_THAN" as const, raw: "100" }] };
    expect(buildRule(state, "acc", "BRL").rule?.action).toEqual({ type: "CHANGE_BUDGET", budgetPercent: -15 });
  });

  it("drops budget actions and chosen objects when switching to ads", () => {
    const state = { ...emptyRuleBuilder(), action: "INCREASE_BUDGET" as const, objectIds: ["1"] };
    expect(withEntity(state, "AD")).toMatchObject({ entity: "AD", action: "PAUSE", objectIds: [] });
    expect(withEntity(state, "CAMPAIGN").action).toBe("INCREASE_BUDGET");
  });

  it("parses whole percents from 1 to 100", () => {
    expect(parsePercent("20")).toBe(20);
    expect(parsePercent("0")).toBeNull();
    expect(parsePercent("101")).toBeNull();
    expect(parsePercent("2,5")).toBeNull();
  });

  it("previews a half finished rule without throwing", () => {
    const sentence = previewRule(emptyRuleBuilder(), "BRL");
    expect(Number.isNaN(sentence.conditions[0].value)).toBe(true);
    expect(formatRuleValue(sentence.conditions[0].value, "spent", "BRL", "pt-BR")).toBe(EMPTY_VALUE);
  });
});
