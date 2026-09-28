import type { AvailablePermission, PermissionRisk } from "./types";

const LEVEL_ORDER: Record<PermissionRisk["level"], number> = { high: 0, medium: 1 };

export function riskBadges(permission: AvailablePermission, action: string): PermissionRisk[] {
  const risks = permission.risks?.[action] ?? [];
  return [...risks].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}
