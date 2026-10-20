import type { PickedGroup } from "@/lib/unofficial-whatsapp-campaigns/group-audience";
import type { GroupOrigin, WorkspaceGroup } from "@/lib/unofficial-whatsapp-groups/types";

export interface PickedCampaignGroup extends PickedGroup {
  origin: GroupOrigin;
  runningCampaigns: number;
}

export function pickedFromGroup(group: Pick<WorkspaceGroup, "id" | "jid" | "subject" | "origin">, runningCampaigns = 0): PickedCampaignGroup {
  return { id: group.id, jid: group.jid, subject: group.subject, origin: group.origin, runningCampaigns };
}

export function pickedInRunningCampaigns(groups: readonly PickedCampaignGroup[]): number {
  return groups.filter((group) => group.runningCampaigns > 0).length;
}

export function hasExternalPick(groups: readonly PickedCampaignGroup[]): boolean {
  return groups.some((group) => group.origin === "external");
}

export function campaignPipelineId(isGroups: boolean, pipelineId: string): string | null {
  return isGroups ? null : pipelineId || null;
}
