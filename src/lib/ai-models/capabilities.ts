import type { ModelPricingInfo } from "@/lib/agents/types";

export const MODEL_CAPABILITIES = ["vision", "tools", "reasoning", "long_context", "image_output", "audio_input", "low_price", "free"] as const;

export type ModelCapability = (typeof MODEL_CAPABILITIES)[number];

export function isModelCapability(value: string): value is ModelCapability {
  return (MODEL_CAPABILITIES as readonly string[]).includes(value);
}

export function modelCapabilitiesOf(info: ModelPricingInfo | undefined): ModelCapability[] {
  return (info?.capabilities ?? []).filter(isModelCapability);
}

export function missingCapabilities(info: ModelPricingInfo | undefined, required: readonly ModelCapability[]): ModelCapability[] {
  const held = modelCapabilitiesOf(info);
  return required.filter((capability) => !held.includes(capability));
}

export function hasCapabilities(info: ModelPricingInfo | undefined, required: readonly ModelCapability[]): boolean {
  return missingCapabilities(info, required).length === 0;
}

export function pricingIndex(pricing: readonly ModelPricingInfo[] | undefined): Map<string, ModelPricingInfo> {
  return new Map((pricing ?? []).map((info) => [info.id, info]));
}

export function filterByCapabilities(ids: readonly string[], pricing: readonly ModelPricingInfo[] | undefined, required: readonly ModelCapability[]): string[] {
  if (required.length === 0) return [...ids];
  const byId = pricingIndex(pricing);
  return ids.filter((id) => hasCapabilities(byId.get(id), required));
}

export function recommendModel(ids: readonly string[], pricing: readonly ModelPricingInfo[] | undefined, required: readonly ModelCapability[]): string | null {
  return filterByCapabilities(ids, pricing, required)[0] ?? null;
}

export function offeredCapabilities(pricing: readonly ModelPricingInfo[] | undefined, surface: readonly ModelCapability[]): ModelCapability[] {
  const present = new Set((pricing ?? []).flatMap(modelCapabilitiesOf));
  return surface.filter((capability) => present.has(capability));
}
