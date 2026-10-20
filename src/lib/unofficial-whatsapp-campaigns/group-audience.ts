import type { GroupRow, NumberSeat } from "@/lib/unofficial-whatsapp-groups/types";

import type { GroupSenderBlock, UnofficialWhatsAppCampaignTarget } from "./types";

export interface PickedGroup {
  id: string;
  jid: string;
  subject: string;
}

export interface GroupPrefill {
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
  return { groupIds: [...new Set(ids)] };
}

export interface GroupPosting {
  senders: NumberSeat[];
  block?: GroupSenderBlock;
}

export function groupPosting(row: Pick<GroupRow, "group" | "numbers">): GroupPosting {
  const senders = row.numbers.filter((seat) => seat.canPost);
  if (senders.length > 0) return { senders };
  if (row.numbers.length === 0) return { senders, block: "not_in_group" };
  const postsOnceBack = row.numbers.some((seat) => !seat.connected && (!row.group.announce || seat.admin));
  return { senders, block: postsOnceBack ? "offline" : "cannot_post" };
}

export function blocksForGood(block: GroupSenderBlock | undefined): boolean {
  return block === "not_in_group" || block === "cannot_post";
}

export function groupTargets(groups: PickedGroup[]): UnofficialWhatsAppCampaignTarget[] {
  return groups.map((group) => ({ groupJid: group.jid, name: group.subject }));
}
