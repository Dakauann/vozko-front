import { isCount, isJson, isText, type Json } from "@/lib/json/guards";

export const MAX_BASIS_POINTS = 10_000;

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface OptionChoiceStats {
  optionId: string;
  shown: number;
  clicks: number;
  ctr: number;
  tracked: boolean | null;
}

export interface FreeTextStats {
  count: number;
  rate: number;
}

export interface PromptStats {
  sends: number;
  clickedPrompts: number;
  clickRate: number;
  freeText: FreeTextStats;
  options: OptionChoiceStats[];
}

export interface ChoicePeriod {
  from: string | null;
  to: string | null;
  timezone: string;
}

export interface WorkflowChoiceStats extends ChoicePeriod {
  version: number | null;
  nodes: ReadonlyMap<string, PromptStats>;
}

export interface PromptChoiceStats extends ChoicePeriod {
  prompt: PromptStats;
}

type TrackedRule = "optional" | "required";

function isBasisPoints(value: unknown): value is number {
  return isCount(value) && value <= MAX_BASIS_POINTS;
}

function readTracked(value: unknown, rule: TrackedRule): boolean | null | undefined {
  if (typeof value === "boolean") return value;
  if (value === undefined && rule === "optional") return null;
  return undefined;
}

function readOption(raw: unknown, rule: TrackedRule): OptionChoiceStats | null {
  if (!isJson(raw)) return null;
  const { optionId, shown, clicks, ctr } = raw;
  const tracked = readTracked(raw.tracked, rule);
  if (!isText(optionId) || !isCount(shown) || !isCount(clicks) || !isBasisPoints(ctr) || tracked === undefined) return null;
  return { optionId, shown, clicks, ctr, tracked };
}

function readFreeText(raw: unknown): FreeTextStats | null {
  if (!isJson(raw) || !isCount(raw.count) || !isBasisPoints(raw.rate)) return null;
  return { count: raw.count, rate: raw.rate };
}

function readPrompt(raw: unknown, rule: TrackedRule): PromptStats | null {
  if (!isJson(raw) || !Array.isArray(raw.options)) return null;
  const { sends, clickedPrompts, clickRate } = raw;
  const freeText = readFreeText(raw.freeText);
  if (!isCount(sends) || !isCount(clickedPrompts) || !isBasisPoints(clickRate) || !freeText) return null;
  const options: OptionChoiceStats[] = [];
  const seen = new Set<string>();
  for (const entry of raw.options) {
    const option = readOption(entry, rule);
    if (!option || seen.has(option.optionId)) return null;
    seen.add(option.optionId);
    options.push(option);
  }
  return { sends, clickedPrompts, clickRate, freeText, options };
}

function readDay(value: unknown, lifetime: boolean): string | null | undefined {
  if (typeof value === "string" && CALENDAR_DAY.test(value)) return value;
  if (lifetime && (value === null || value === undefined)) return null;
  return undefined;
}

function readPeriod(raw: Json, lifetime: boolean): ChoicePeriod | null {
  const from = readDay(raw.from, lifetime);
  const to = readDay(raw.to, lifetime);
  if (from === undefined || to === undefined || !isText(raw.timezone)) return null;
  return { from, to, timezone: raw.timezone };
}

export function readWorkflowChoiceStats(raw: unknown): WorkflowChoiceStats | null {
  if (!isJson(raw) || !Array.isArray(raw.nodes)) return null;
  const period = readPeriod(raw, false);
  const version = raw.version === null ? null : isCount(raw.version) ? raw.version : undefined;
  if (!period || version === undefined) return null;
  const nodes = new Map<string, PromptStats>();
  for (const entry of raw.nodes) {
    if (!isJson(entry) || !isText(entry.nodeId) || nodes.has(entry.nodeId)) return null;
    const prompt = readPrompt(entry, "optional");
    if (!prompt) return null;
    nodes.set(entry.nodeId, prompt);
  }
  return { ...period, version, nodes };
}

function readPromptBody(raw: unknown, rule: TrackedRule): PromptChoiceStats | null {
  if (!isJson(raw)) return null;
  const period = readPeriod(raw, true);
  const prompt = readPrompt(raw.prompt, rule);
  return period && prompt ? { ...period, prompt } : null;
}

export function readPromptChoiceStats(raw: unknown): PromptChoiceStats | null {
  return readPromptBody(raw, "optional");
}

export function readTemplateChoiceStats(raw: unknown): PromptChoiceStats | null {
  return readPromptBody(raw, "required");
}

export function optionStatsOf(stats: PromptStats, optionId: string): OptionChoiceStats | null {
  return stats.options.find((option) => option.optionId === optionId) ?? null;
}

function sameOption(a: OptionChoiceStats, b: OptionChoiceStats): boolean {
  return a.optionId === b.optionId && a.shown === b.shown && a.clicks === b.clicks && a.ctr === b.ctr && a.tracked === b.tracked;
}

export function sameNodeChoiceStats(a: PromptStats, b: PromptStats): boolean {
  return (
    a.sends === b.sends &&
    a.clickedPrompts === b.clickedPrompts &&
    a.clickRate === b.clickRate &&
    a.freeText.count === b.freeText.count &&
    a.freeText.rate === b.freeText.rate &&
    a.options.length === b.options.length &&
    a.options.every((option, index) => sameOption(option, b.options[index]))
  );
}
