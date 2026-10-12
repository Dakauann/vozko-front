import { apiClient } from "@/lib/api/browser-client";
import type { AnimationPreset, PresetAnimation } from "@/lib/studio/animation-presets";

import { settleResult, type ActionResult } from "./action-result";

const PRESETS_PATH = "/studio/animation-presets";

function presetPath(id: string): string {
  return `${PRESETS_PATH}/${encodeURIComponent(id)}`;
}

export interface PresetInput {
  name: string;
  description?: string;
  animation: PresetAnimation;
}

export async function listAnimationPresetsAction(): Promise<ActionResult<{ items: AnimationPreset[] }>> {
  return settleResult(await apiClient<{ items: AnimationPreset[] }>(PRESETS_PATH, { method: "GET" }));
}

export async function createAnimationPresetAction(input: PresetInput): Promise<ActionResult<AnimationPreset>> {
  return settleResult(await apiClient<AnimationPreset>(PRESETS_PATH, { method: "POST", body: JSON.stringify(input) }));
}

export async function renameAnimationPresetAction(id: string, change: { name?: string; description?: string }): Promise<ActionResult<AnimationPreset>> {
  return settleResult(await apiClient<AnimationPreset>(presetPath(id), { method: "PATCH", body: JSON.stringify(change) }));
}

export async function deleteAnimationPresetAction(id: string): Promise<ActionResult<true>> {
  return settleResult(await apiClient<true>(presetPath(id), { method: "DELETE" }), true);
}
