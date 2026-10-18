import type { SetupWarning } from "@/lib/unofficial-whatsapp-groups/types";

const warningsByGroup = new Map<string, SetupWarning[]>();

export function rememberSetupWarnings(groupId: string, warnings: SetupWarning[]): void {
  if (warnings.length === 0) return;
  warningsByGroup.set(groupId, [...warnings]);
}

export function recallSetupWarnings(groupId: string): SetupWarning[] {
  return warningsByGroup.get(groupId) ?? [];
}

export function forgetSetupWarnings(groupId: string): void {
  warningsByGroup.delete(groupId);
}
