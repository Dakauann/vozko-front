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
