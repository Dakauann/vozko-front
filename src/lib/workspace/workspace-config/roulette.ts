import type { RouletteMode, WorkspaceConfig } from "./types";

export const ROULETTE_DEFAULTS = {
  mode: "online" as RouletteMode,
  windowHours: 48,
  rescueEnabled: true,
  rescueMinutes: 15,
};

export const ROULETTE_LIMITS = {
  window: { min: 1, max: 168 },
  rescue: { min: 1, max: 1440 },
};

function clamp(value: number | undefined, limits: { min: number; max: number }, fallback: number): number {
  if (value === undefined || value < limits.min) return fallback;
  return Math.min(value, limits.max);
}

export type HandOffRules = {
  mode: RouletteMode;
  windowHours: number;
  skipAdmins: boolean;
  rescue: { afterMinutes: number; workingHoursOnly: boolean } | null;
};

export function handOffRules(config: WorkspaceConfig | null): HandOffRules {
  const mode: RouletteMode = config?.rouletteMode === "last_seen" ? "last_seen" : "online";
  const rescueOn = mode === "last_seen" && (config?.rouletteRescueEnabled ?? ROULETTE_DEFAULTS.rescueEnabled);
  return {
    mode,
    windowHours: clamp(config?.rouletteLastSeenWindowHours, ROULETTE_LIMITS.window, ROULETTE_DEFAULTS.windowHours),
    skipAdmins: config?.skipAdminAssignment ?? false,
    rescue: rescueOn
      ? {
          afterMinutes: clamp(config?.rouletteRescueAfterMinutes, ROULETTE_LIMITS.rescue, ROULETTE_DEFAULTS.rescueMinutes),
          workingHoursOnly: Boolean(config?.workingHours),
        }
      : null,
  };
}
