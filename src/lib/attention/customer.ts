import { conversationHref } from "@/lib/conversations/deep-link";
import type { InboxEntry } from "@/lib/conversations/types";

import type { AttentionSignal } from "./rules";

export function customerMessageArrived(before: InboxEntry | undefined, after: InboxEntry): boolean {
  if (before && after.last_message_at === before.last_message_at) return false;
  if (after.last_message_sender_kind) return after.last_message_sender_kind === "contact";
  return after.unread_count > (before?.unread_count ?? 0);
}

export function customerMessageSignal(entry: InboxEntry): AttentionSignal {
  return {
    id: `customer:${entry.entry_type}:${entry.entry_id}:${entry.last_message_at}`,
    source: "customer_message",
    group: entry.entry_id,
    title: entry.lead_name || entry.lead_number,
    body: entry.last_message_preview,
    href: conversationHref(entry.entry_id, entry.entry_type),
  };
}
