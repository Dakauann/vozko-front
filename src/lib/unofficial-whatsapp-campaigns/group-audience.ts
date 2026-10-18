import type { GroupRow, NumberSeat } from "@/lib/unofficial-whatsapp-groups/types";

import type { UnofficialWhatsAppCampaignTarget } from "./types";

export interface PickedGroup {
  id: string;
  jid: string;
  subject: string;
}

export interface GroupPrefill {
  instanceId: string;
  groupIds: string[];
}

type QueryValue = string | string[] | undefined;

function first(value: QueryValue): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}

export function readGroupPrefill(query: Record<string, QueryValue>): GroupPrefill | null {
  if (first(query.audience) !== "groups") return null;
  const ids = first(query.groups)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return { instanceId: first(query.instanceId), groupIds: [...new Set(ids)] };
}

export function numberCanPost(seats: NumberSeat[], instanceId: string): boolean {
  return seats.some((seat) => seat.instanceId === instanceId && seat.canPost);
}

export function splitByPosting(rows: GroupRow[], instanceId: string): { postable: GroupRow[]; readOnly: number } {
  const postable = rows.filter((row) => numberCanPost(row.numbers, instanceId));
  return { postable, readOnly: rows.length - postable.length };
}

export function groupTargets(groups: PickedGroup[]): UnofficialWhatsAppCampaignTarget[] {
  return groups.map((group) => ({ groupJid: group.jid, name: group.subject }));
}
