import type { ModelPricingInfo } from "@/lib/agents/types";

export const REASONING_LEVELS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

export const REASONING_LEVEL_KEY = "reasoning_level";

export type ReasoningLevel = (typeof REASONING_LEVELS)[number];

export interface ReasoningOptions {
  levels: ReasoningLevel[];
  default: ReasoningLevel;
}

export interface ReasoningAdjustment {
  from: string;
  to: ReasoningLevel | null;
}

export function isReasoningLevel(value: string): value is ReasoningLevel {
  return (REASONING_LEVELS as readonly string[]).includes(value);
}

export function reasoningOptionsOf(pricing: readonly ModelPricingInfo[] | undefined, modelId: string): ReasoningOptions | undefined {
  const offer = pricing?.find((info) => info.id === modelId)?.reasoning;
  if (!offer) return undefined;
  const levels = offer.levels.filter(isReasoningLevel);
  if (levels.length === 0 || !isReasoningLevel(offer.default) || !levels.includes(offer.default)) return undefined;
  return { levels, default: offer.default };
}

export function resolveReasoning(options: ReasoningOptions | undefined, stored: string): ReasoningLevel | "" {
  return options && isReasoningLevel(stored) && options.levels.includes(stored) ? stored : "";
}

export function displayedReasoning(options: ReasoningOptions | undefined, stored: string): ReasoningLevel | null {
  if (!options) return null;
  return resolveReasoning(options, stored) || options.default;
}

export function reasoningAfterModelChange(stored: string, next: ReasoningOptions | undefined): { level: ReasoningLevel | ""; adjusted: ReasoningAdjustment | null } {
  if (!stored) return { level: "", adjusted: null };
  const kept = resolveReasoning(next, stored);
  if (kept) return { level: kept, adjusted: null };
  return { level: "", adjusted: { from: stored, to: next?.default ?? null } };
}
