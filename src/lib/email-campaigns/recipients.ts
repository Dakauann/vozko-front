import type { StatusChipTone } from "@/components/elevated-design/status-chip";

import type { Recipient } from "./types";

export type RecipientStateKey =
  | "pending"
  | "skipped"
  | "failed"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "unsubscribed";

export interface RecipientState {
  key: RecipientStateKey;
  tone: StatusChipTone;
  at?: string;
}

export function recipientState(recipient: Recipient): RecipientState {
  switch (recipient.status) {
    case "pending":
      return { key: "pending", tone: "outline" };
    case "skipped":
      return { key: "skipped", tone: "muted" };
    case "failed":
      return { key: "failed", tone: "fault" };
  }
  if (recipient.complained_at) return { key: "complained", tone: "fault", at: recipient.complained_at };
  if (recipient.bounced_at) return { key: "bounced", tone: "fault", at: recipient.bounced_at };
  if (recipient.unsubscribed_at) return { key: "unsubscribed", tone: "warning", at: recipient.unsubscribed_at };
  if (recipient.clicked_at) return { key: "clicked", tone: "healthy", at: recipient.clicked_at };
  if (recipient.opened_at) return { key: "opened", tone: "healthy", at: recipient.opened_at };
  if (recipient.delivered_at) return { key: "delivered", tone: "neutral", at: recipient.delivered_at };
  return { key: "sent", tone: "outline", at: recipient.sent_at };
}

export const RECIPIENTS_PAGE_SIZE = 25;
