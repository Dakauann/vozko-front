import type { AvailablePermission, PermissionEntry } from "@/lib/workspace/types";

export function describePermission(catalog: AvailablePermission[], permission: PermissionEntry): string {
  const resource = catalog.find((entry) => entry.resource === permission.resource);
  return resource?.actionDescriptions?.[permission.action] ?? `${permission.resource}:${permission.action}`;
}
