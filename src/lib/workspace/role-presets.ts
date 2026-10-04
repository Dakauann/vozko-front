import { riskBadges } from "./permission-risk";
import type {
  AvailablePermission,
  CustomRole,
  Feature,
  PermissionEntry,
  PermissionRisk,
  RolePreset,
} from "./types";

type PermissionLike = { resource: string; action: string };
export type PermissionMap = Record<string, Set<string>>;

export function permissionKey(entry: PermissionLike): string {
  return `${entry.resource}:${entry.action}`;
}

function keySet(entries: PermissionLike[]): Set<string> {
  return new Set(entries.map(permissionKey));
}

export function permissionMapToEntries(map: PermissionMap): PermissionLike[] {
  const entries: PermissionLike[] = [];
  for (const [resource, actions] of Object.entries(map)) {
    for (const action of actions) entries.push({ resource, action });
  }
  return entries;
}

export function samePermissions(a: PermissionLike[], b: PermissionLike[]): boolean {
  const left = keySet(a);
  const right = keySet(b);
  if (left.size !== right.size) return false;
  for (const key of left) if (!right.has(key)) return false;
  return true;
}

export function permissionDiff(
  current: PermissionLike[],
  baseline: PermissionLike[],
): { added: number; removed: number; total: number } {
  const now = keySet(current);
  const before = keySet(baseline);
  let added = 0;
  let removed = 0;
  for (const key of now) if (!before.has(key)) added += 1;
  for (const key of before) if (!now.has(key)) removed += 1;
  return { added, removed, total: added + removed };
}

export function knownPermissions<T extends PermissionLike>(
  entries: T[],
  available: AvailablePermission[],
): T[] {
  const known = new Set<string>();
  for (const perm of available) {
    for (const action of perm.actions ?? []) known.add(`${perm.resource}:${action}`);
  }
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = permissionKey(entry);
    if (!known.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function presetPermissions(
  preset: RolePreset,
  available: AvailablePermission[],
): PermissionEntry[] {
  return knownPermissions(preset.permissions, available);
}

export function matchingPreset(
  entries: PermissionLike[],
  presets: RolePreset[],
  available: AvailablePermission[],
): RolePreset | null {
  const own = knownPermissions(entries, available);
  if (own.length === 0) return null;
  return presets.find((preset) => samePermissions(own, presetPermissions(preset, available))) ?? null;
}

export interface CapabilityGroup {
  featureKey: string;
  featureName: string;
  capabilities: Array<{ key: string; description: string }>;
}

export function capabilitySummary(features: Feature[], map: PermissionMap): CapabilityGroup[] {
  const groups: CapabilityGroup[] = [];
  for (const feature of features) {
    const granted = feature.capabilities.filter(
      (capability) =>
        !capability.managersOnly &&
        capability.requires.length > 0 &&
        capability.requires.every((need) => map[need.resource]?.has(need.action)),
    );
    if (granted.length === 0) continue;
    groups.push({
      featureKey: feature.key,
      featureName: feature.name,
      capabilities: granted.map((capability) => ({
        key: capability.key,
        description: capability.description,
      })),
    });
  }
  return groups;
}

export function autofillValue(current: string, lastSuggestion: string, nextSuggestion: string): string {
  const untouched = current === lastSuggestion || current.trim() === "";
  return untouched ? nextSuggestion : current;
}

export interface PresetRisk {
  kind: PermissionRisk["kind"];
  level: PermissionRisk["level"];
}

export function presetRisks(
  entries: PermissionLike[],
  available: AvailablePermission[],
): PresetRisk[] {
  const byResource = new Map(available.map((perm) => [perm.resource as string, perm]));
  const found = new Map<PermissionRisk["kind"], PermissionRisk["level"]>();
  for (const entry of entries) {
    const perm = byResource.get(entry.resource);
    if (!perm) continue;
    for (const risk of riskBadges(perm, entry.action)) {
      if (found.get(risk.kind) !== "high") found.set(risk.kind, risk.level);
    }
  }
  return [...found.entries()]
    .map(([kind, level]) => ({ kind, level }))
    .sort((a, b) => (a.level === b.level ? 0 : a.level === "high" ? -1 : 1));
}

export function shouldConfirmReplace(
  current: PermissionLike[],
  baseline: PermissionLike[],
  target: PermissionLike[],
): boolean {
  return !samePermissions(current, baseline) && !samePermissions(current, target);
}

export type RoleSource =
  | { kind: "blank" }
  | { kind: "preset"; key: string; linked: boolean };

export function initialRoleSource(role?: Pick<CustomRole, "presetKey" | "linked">): RoleSource {
  if (!role?.presetKey) return { kind: "blank" };
  return { kind: "preset", key: role.presetKey, linked: role.linked };
}

export function isPermissionEditingLocked(source: RoleSource): boolean {
  return source.kind === "preset" && source.linked;
}

export function canLinkPreset(presetKey: string, original?: Pick<CustomRole, "presetKey">): boolean {
  if (!original) return true;
  return original.presetKey === presetKey;
}

export function sourceForChosenPreset(
  presetKey: string,
  original?: Pick<CustomRole, "presetKey">,
): RoleSource {
  return { kind: "preset", key: presetKey, linked: canLinkPreset(presetKey, original) };
}

export interface RoleDraft {
  name: string;
  description: string;
  permissions: PermissionEntry[];
  source: RoleSource;
}

export interface CreateRolePayload {
  name: string;
  description?: string;
  permissions: PermissionEntry[];
  presetKey?: string;
  linked?: boolean;
}

export interface UpdateRolePayload {
  name: string;
  description?: string;
  permissions?: PermissionEntry[];
  linked?: boolean;
}

export function buildCreatePayload(draft: RoleDraft): CreateRolePayload {
  const base = {
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    permissions: draft.permissions,
  };
  if (draft.source.kind === "blank") return base;
  return { ...base, presetKey: draft.source.key, linked: draft.source.linked };
}

export function buildUpdatePayload(
  draft: RoleDraft,
  original: Pick<CustomRole, "presetKey" | "linked">,
): UpdateRolePayload {
  const base = {
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
  };
  const wantsLink =
    draft.source.kind === "preset" &&
    draft.source.linked &&
    draft.source.key === original.presetKey;
  if (wantsLink) return original.linked ? base : { ...base, linked: true };
  return original.linked
    ? { ...base, permissions: draft.permissions, linked: false }
    : { ...base, permissions: draft.permissions };
}

export type RoleSaveError =
  | { field: "name"; messageKey: "errors.nameTaken" }
  | { field: "form"; messageKey: "errors.roleLinked" | "errors.unknownPreset" }
  | { field: "form"; message: string };

export function roleSaveError(code: string | undefined, message: string): RoleSaveError {
  if (code === "role_name_taken") return { field: "name", messageKey: "errors.nameTaken" };
  if (code === "role_linked") return { field: "form", messageKey: "errors.roleLinked" };
  if (code === "unknown_role_preset") return { field: "form", messageKey: "errors.unknownPreset" };
  return { field: "form", message };
}

export function saveBlocker(name: string, permissionCount: number): "name" | "permissions" | null {
  if (name.trim() === "") return "name";
  if (permissionCount === 0) return "permissions";
  return null;
}
