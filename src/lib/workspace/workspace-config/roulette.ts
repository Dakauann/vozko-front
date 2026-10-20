import type { RouletteMode, RouletteRecipient, RouletteStrategy, WorkspaceConfig } from "./types";

export const ROULETTE_DEFAULTS = {
  mode: "online" as RouletteMode,
  strategy: "round_robin" as RouletteStrategy,
  windowHours: 48,
  rescueEnabled: true,
  rescueMinutes: 15,
  maxOpenPerMember: 0,
};

export const ROULETTE_LIMITS = {
  window: { min: 1, max: 168 },
  rescue: { min: 1, max: 1440 },
  tier: { min: 1, max: 10 },
  weight: { min: 1, max: 10 },
  maxOpen: { min: 0, max: 500 },
};

export const ROULETTE_STRATEGIES: readonly RouletteStrategy[] = [
  "round_robin",
  "priority",
  "weighted",
  "least_busy",
  "longest_idle",
  "random",
  "claim",
];

function clamp(value: number | undefined, limits: { min: number; max: number }, fallback: number): number {
  if (value === undefined || value < limits.min) return fallback;
  return Math.min(value, limits.max);
}

function bound(value: number, limits: { min: number; max: number }): number {
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)));
}

export function rouletteStrategyOf(config: WorkspaceConfig | null): RouletteStrategy {
  const stored = config?.rouletteStrategy;
  return stored && ROULETTE_STRATEGIES.includes(stored) ? stored : ROULETTE_DEFAULTS.strategy;
}

export function choosesFromRecipients(strategy: RouletteStrategy): boolean {
  return strategy === "priority" || strategy === "weighted";
}

export function maxOpenOf(config: WorkspaceConfig | null): number {
  return clamp(config?.rouletteMaxOpenPerMember, ROULETTE_LIMITS.maxOpen, ROULETTE_DEFAULTS.maxOpenPerMember);
}

function byTierThenMember(a: RouletteRecipient, b: RouletteRecipient): number {
  return a.tier - b.tier || a.userId.localeCompare(b.userId);
}

export function recipientsOf(config: WorkspaceConfig | null): RouletteRecipient[] {
  return [...(config?.rouletteRecipients ?? [])].sort(byTierThenMember);
}

export function withRecipient(
  list: RouletteRecipient[],
  userId: string,
  patch: Partial<Omit<RouletteRecipient, "userId">> | null,
): RouletteRecipient[] {
  const others = list.filter((r) => r.userId !== userId);
  if (patch === null) return others.sort(byTierThenMember);
  const current = list.find((r) => r.userId === userId) ?? { userId, tier: ROULETTE_LIMITS.tier.min, weight: ROULETTE_LIMITS.weight.min };
  const next: RouletteRecipient = {
    userId,
    tier: bound(patch.tier ?? current.tier, ROULETTE_LIMITS.tier),
    weight: bound(patch.weight ?? current.weight, ROULETTE_LIMITS.weight),
  };
  return [...others, next].sort(byTierThenMember);
}

export function sameRecipients(a: RouletteRecipient[], b: RouletteRecipient[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort(byTierThenMember);
  const right = [...b].sort(byTierThenMember);
  return left.every((r, i) => r.userId === right[i].userId && r.tier === right[i].tier && r.weight === right[i].weight);
}

type HandOffRules = {
  mode: RouletteMode;
  strategy: RouletteStrategy;
  maxOpenPerMember: number;
  windowHours: number;
  skipAdmins: boolean;
  rescue: { afterMinutes: number; workingHoursOnly: boolean } | null;
};

export function handOffRules(config: WorkspaceConfig | null): HandOffRules {
  const mode: RouletteMode = config?.rouletteMode === "last_seen" ? "last_seen" : "online";
  const rescueOn = mode === "last_seen" && (config?.rouletteRescueEnabled ?? ROULETTE_DEFAULTS.rescueEnabled);
  return {
    mode,
    strategy: rouletteStrategyOf(config),
    maxOpenPerMember: maxOpenOf(config),
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
