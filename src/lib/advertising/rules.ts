import { currencyOffset, formatCount, formatMinor, formatPercent, inputToMinor, minorToInput, EMPTY_VALUE } from "@/lib/advertising/money";

export type RuleEntity = "CAMPAIGN" | "ADSET" | "AD";

export type RuleMetric = "spent" | "results" | "cost_per_result" | "impressions" | "reach" | "frequency" | "cpc" | "cpm" | "ctr";

export type RuleOperator = "GREATER_THAN" | "LESS_THAN";

export type RuleWindow = "TODAY" | "YESTERDAY" | "LAST_3_DAYS" | "LAST_7_DAYS" | "LAST_14_DAYS" | "LAST_30_DAYS" | "LIFETIME";

export type RuleActionType = "PAUSE" | "UNPAUSE" | "CHANGE_BUDGET";

export type RuleFrequency = "SEMI_HOURLY" | "HOURLY" | "DAILY";

export type RuleStatus = "ENABLED" | "DISABLED";

export interface RuleCondition {
  metric: RuleMetric;
  operator: RuleOperator;
  value: number;
}

export interface RuleAction {
  type: RuleActionType;
  budgetPercent?: number;
  budgetCap?: number;
}

export interface AutomatedRule {
  metaId?: string;
  adAccountId: string;
  name: string;
  status: RuleStatus | string;
  entity: RuleEntity;
  objectIds?: string[];
  conditions: RuleCondition[];
  window: RuleWindow;
  action: RuleAction;
  frequency: RuleFrequency;
  createdTime?: string;
}

export interface RuleRun {
  at: string;
  result: string;
  objects?: string[] | null;
}

export const RULE_ENTITIES: RuleEntity[] = ["CAMPAIGN", "ADSET", "AD"];
export const RULE_METRICS: RuleMetric[] = ["cost_per_result", "spent", "results", "cpc", "cpm", "ctr", "impressions", "reach", "frequency"];
export const RULE_OPERATORS: RuleOperator[] = ["GREATER_THAN", "LESS_THAN"];
export const RULE_WINDOWS: RuleWindow[] = ["TODAY", "YESTERDAY", "LAST_3_DAYS", "LAST_7_DAYS", "LAST_14_DAYS", "LAST_30_DAYS", "LIFETIME"];
export const RULE_FREQUENCIES: RuleFrequency[] = ["SEMI_HOURLY", "HOURLY", "DAILY"];
export const MAX_RULE_CONDITIONS = 5;
export const MAX_BUDGET_PERCENT = 100;

export type RuleActionChoice = "PAUSE" | "UNPAUSE" | "INCREASE_BUDGET" | "DECREASE_BUDGET";

export const RULE_ACTION_CHOICES: RuleActionChoice[] = ["PAUSE", "UNPAUSE", "INCREASE_BUDGET", "DECREASE_BUDGET"];

const MONEY_METRICS: RuleMetric[] = ["spent", "cost_per_result", "cpc", "cpm"];

export function isMoneyMetric(metric: RuleMetric): boolean {
  return MONEY_METRICS.includes(metric);
}

export type MetricUnit = "money" | "percent" | "ratio" | "count";

export function metricUnit(metric: RuleMetric): MetricUnit {
  if (isMoneyMetric(metric)) return "money";
  if (metric === "ctr") return "percent";
  if (metric === "frequency") return "ratio";
  return "count";
}

function parseDecimal(raw: string): number | null {
  const compact = raw.trim().replace(/\s/g, "");
  if (compact === "") return null;
  const grouped = /^\d{1,3}(\.\d{3})+$/.test(compact);
  const normalized = compact.includes(",") || grouped ? compact.replace(/\./g, "").replace(",", ".") : compact;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function ruleValueFromInput(raw: string, metric: RuleMetric, currency: string): number | null {
  const unit = metricUnit(metric);
  if (unit === "money") {
    const offset = currencyOffset(currency);
    const minor = inputToMinor(raw, currency);
    return offset && minor !== null ? minor / offset : null;
  }
  const value = parseDecimal(raw);
  if (value === null) return null;
  return unit === "count" ? Math.round(value) : value;
}

export function ruleValueToInput(value: number, metric: RuleMetric, currency: string): string {
  if (!Number.isFinite(value) || value < 0) return "";
  if (metricUnit(metric) === "money") {
    const offset = currencyOffset(currency);
    return offset ? minorToInput(Math.round(value * offset), currency) : "";
  }
  return String(value).replace(".", ",");
}

export function formatRuleValue(value: number, metric: RuleMetric, currency: string, tag: string): string {
  if (!Number.isFinite(value)) return EMPTY_VALUE;
  switch (metricUnit(metric)) {
    case "money": {
      const offset = currencyOffset(currency);
      return offset ? formatMinor(Math.round(value * offset), currency, tag) : EMPTY_VALUE;
    }
    case "percent":
      return formatPercent(value, tag);
    case "ratio":
      return new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }).format(value);
    default:
      return formatCount(value, tag);
  }
}

export function actionChoiceOf(action: RuleAction): RuleActionChoice {
  if (action.type === "CHANGE_BUDGET") return (action.budgetPercent ?? 0) < 0 ? "DECREASE_BUDGET" : "INCREASE_BUDGET";
  return action.type;
}

export function actionFromChoice(choice: RuleActionChoice, percent: number): RuleAction {
  const size = Math.min(MAX_BUDGET_PERCENT, Math.max(1, Math.round(Math.abs(percent))));
  if (choice === "INCREASE_BUDGET") return { type: "CHANGE_BUDGET", budgetPercent: size };
  if (choice === "DECREASE_BUDGET") return { type: "CHANGE_BUDGET", budgetPercent: -size };
  return { type: choice };
}

export function choicesFor(entity: RuleEntity): RuleActionChoice[] {
  return entity === "AD" ? ["PAUSE", "UNPAUSE"] : RULE_ACTION_CHOICES;
}

export interface RuleSentenceParts {
  entity: RuleEntity;
  scope: "all" | "chosen";
  chosenCount: number;
  window: RuleWindow;
  conditions: { metric: RuleMetric; operator: RuleOperator; value: string }[];
  action: RuleActionChoice;
  percent: number;
  frequency: RuleFrequency;
}

export function ruleSentenceParts(
  rule: Pick<AutomatedRule, "entity" | "objectIds" | "window" | "conditions" | "action" | "frequency">,
  currency: string,
  tag: string,
): RuleSentenceParts {
  const chosenCount = rule.objectIds?.length ?? 0;
  return {
    entity: rule.entity,
    scope: chosenCount > 0 ? "chosen" : "all",
    chosenCount,
    window: rule.window,
    conditions: rule.conditions.map((condition) => ({
      metric: condition.metric,
      operator: condition.operator,
      value: formatRuleValue(condition.value, condition.metric, currency, tag),
    })),
    action: actionChoiceOf(rule.action),
    percent: Math.abs(rule.action.budgetPercent ?? 0),
    frequency: rule.frequency,
  };
}

export interface RuleWords {
  condition: (metric: RuleMetric, window: RuleWindow, operator: RuleOperator, value: string) => string;
  and: string;
  action: (choice: RuleActionChoice, entity: RuleEntity, percent: number) => string;
  frequency: (frequency: RuleFrequency) => string;
  sentence: (conditions: string, action: string) => string;
}

export function joinConditions(parts: string[], and: string): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} ${and} ${parts[parts.length - 1]}`;
}

export function ruleSentence(parts: RuleSentenceParts, words: RuleWords): string {
  const conditions = joinConditions(
    parts.conditions.map((condition) => words.condition(condition.metric, parts.window, condition.operator, condition.value)),
    words.and,
  );
  return `${words.sentence(conditions, words.action(parts.action, parts.entity, parts.percent))} ${words.frequency(parts.frequency)}`;
}

export interface ConditionDraft {
  metric: RuleMetric;
  operator: RuleOperator;
  raw: string;
}

export interface RuleBuilderState {
  name: string;
  entity: RuleEntity;
  scope: "all" | "chosen";
  objectIds: string[];
  conditions: ConditionDraft[];
  window: RuleWindow;
  action: RuleActionChoice;
  percent: string;
  frequency: RuleFrequency;
}

export function emptyRuleBuilder(): RuleBuilderState {
  return {
    name: "",
    entity: "ADSET",
    scope: "all",
    objectIds: [],
    conditions: [{ metric: "cost_per_result", operator: "GREATER_THAN", raw: "" }],
    window: "TODAY",
    action: "PAUSE",
    percent: "20",
    frequency: "SEMI_HOURLY",
  };
}

export function withEntity(state: RuleBuilderState, entity: RuleEntity): RuleBuilderState {
  const action = choicesFor(entity).includes(state.action) ? state.action : "PAUSE";
  return { ...state, entity, action, objectIds: [] };
}

export function isBudgetChoice(choice: RuleActionChoice): boolean {
  return choice === "INCREASE_BUDGET" || choice === "DECREASE_BUDGET";
}

export function parsePercent(raw: string): number | null {
  const value = Number(raw.trim().replace(",", "."));
  if (!Number.isInteger(value) || value < 1 || value > MAX_BUDGET_PERCENT) return null;
  return value;
}

export interface BuiltRule {
  rule: AutomatedRule | null;
  invalidConditions: number[];
  invalidPercent: boolean;
  missingObjects: boolean;
}

export function buildRule(state: RuleBuilderState, adAccountId: string, currency: string): BuiltRule {
  const values = state.conditions.map((condition) => ruleValueFromInput(condition.raw, condition.metric, currency));
  const invalidConditions = values.flatMap((value, index) => (value === null ? [index] : []));
  const percent = isBudgetChoice(state.action) ? parsePercent(state.percent) : 0;
  const invalidPercent = percent === null;
  const missingObjects = state.scope === "chosen" && state.objectIds.length === 0;
  if (invalidConditions.length > 0 || invalidPercent || missingObjects) {
    return { rule: null, invalidConditions, invalidPercent, missingObjects };
  }
  return {
    rule: {
      adAccountId,
      name: state.name.trim(),
      status: "ENABLED",
      entity: state.entity,
      objectIds: state.scope === "chosen" ? state.objectIds : undefined,
      conditions: state.conditions.map((condition, index) => ({
        metric: condition.metric,
        operator: condition.operator,
        value: values[index] ?? 0,
      })),
      window: state.window,
      action: actionFromChoice(state.action, percent ?? 0),
      frequency: state.frequency,
    },
    invalidConditions,
    invalidPercent,
    missingObjects,
  };
}

export function previewRule(state: RuleBuilderState, currency: string): Pick<AutomatedRule, "entity" | "objectIds" | "window" | "conditions" | "action" | "frequency"> {
  return {
    entity: state.entity,
    objectIds: state.scope === "chosen" ? state.objectIds : undefined,
    window: state.window,
    conditions: state.conditions.map((condition) => ({
      metric: condition.metric,
      operator: condition.operator,
      value: ruleValueFromInput(condition.raw, condition.metric, currency) ?? Number.NaN,
    })),
    action: actionFromChoice(state.action, parsePercent(state.percent) ?? 0),
    frequency: state.frequency,
  };
}
