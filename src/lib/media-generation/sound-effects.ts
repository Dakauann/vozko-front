export const SOUND_EFFECT_MS = { min: 500, max: 22_000, initial: 1_500 } as const;

export const SOUND_EFFECT_PROMPT_LIMIT = 1000;

export function isSoundEffectLength(ms: number): boolean {
  return Number.isInteger(ms) && ms >= SOUND_EFFECT_MS.min && ms <= SOUND_EFFECT_MS.max;
}
