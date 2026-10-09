import { isUpcomingScreen, ruleForPath, type ScreenKey } from "@/lib/navigation/routes";
import type { Feature, FeatureCapability, PermissionEntry } from "@/lib/workspace/types";

export type FeatureCatalog =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; features: Feature[] };

export interface AccessState {
  catalog: FeatureCatalog;
  permissionsLoading: boolean;
  privileged: boolean;
  systemAdmin: boolean;
  has: (permission: PermissionEntry) => boolean;
}

export type AccessDecision =
  | { status: "loading" }
  | { status: "allowed" }
  | { status: "upcoming" }
  | {
      status: "denied";
      feature?: Feature;
      capability?: FeatureCapability;
      missing: PermissionEntry[];
      managersOnly: boolean;
    };

const allowed: AccessDecision = { status: "allowed" };
const loading: AccessDecision = { status: "loading" };
const upcoming: AccessDecision = { status: "upcoming" };
const closed: AccessDecision = { status: "denied", missing: [], managersOnly: false };
const managersOnly: AccessDecision = { status: "denied", missing: [], managersOnly: true };

export function screenCapability(
  features: Feature[],
  screen: ScreenKey,
): { feature: Feature; capability: FeatureCapability } | null {
  for (const feature of features) {
    for (const capability of feature.capabilities) {
      if (capability.screens.includes(screen)) return { feature, capability };
    }
  }
  return null;
}

export function decideScreen(screen: ScreenKey, state: AccessState): AccessDecision {
  if (isUpcomingScreen(screen)) return upcoming;
  if (state.permissionsLoading) return loading;
  if (state.privileged) return allowed;
  if (state.catalog.status === "loading") return loading;
  if (state.catalog.status === "failed") return closed;
  const found = screenCapability(state.catalog.features, screen);
  if (!found) return closed;
  const { feature, capability } = found;
  if (capability.managersOnly) return { status: "denied", feature, capability, missing: [], managersOnly: true };
  const missing = capability.requires.filter((permission) => !state.has(permission));
  return missing.length === 0 ? allowed : { status: "denied", feature, capability, missing, managersOnly: false };
}

export function decidePath(pathname: string, state: AccessState): AccessDecision {
  const rule = ruleForPath(pathname);
  if (!rule) return closed;
  switch (rule.kind) {
    case "personal":
      return allowed;
    case "platform_admin":
      return state.systemAdmin ? allowed : closed;
    case "workspace_manager":
      if (state.permissionsLoading) return loading;
      return state.privileged ? allowed : managersOnly;
    case "screen":
      return decideScreen(rule.screen, state);
  }
}

export type CapabilityDecision = "loading" | "granted" | "denied";

function findCapability(features: Feature[], key: string): FeatureCapability | null {
  for (const feature of features) {
    const found = feature.capabilities.find((capability) => capability.key === key);
    if (found) return found;
  }
  return null;
}

export function decideCapabilities(keys: readonly string[], state: AccessState): CapabilityDecision {
  if (state.permissionsLoading) return "loading";
  if (keys.length === 0) return "denied";
  if (state.privileged) return "granted";
  if (state.catalog.status === "loading") return "loading";
  if (state.catalog.status === "failed") return "denied";
  const { features } = state.catalog;
  for (const key of keys) {
    const capability = findCapability(features, key);
    if (!capability || capability.managersOnly) return "denied";
    if (!capability.requires.every((permission) => state.has(permission))) return "denied";
  }
  return "granted";
}
