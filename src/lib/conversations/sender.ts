import type { ConversationMessage } from "@/lib/conversations/types";

export type SenderKind = "contact" | "human" | "ai" | "workflow" | "campaign" | "external" | "system";

export type MessageSender = { kind: SenderKind; id: string };

const SENDER_KINDS: readonly SenderKind[] = ["contact", "human", "ai", "workflow", "campaign", "external", "system"];

type SenderCarrier = { sent_by?: unknown; sentBy?: unknown };

export function senderOf(message: ConversationMessage): MessageSender | null {
  const carrier = message as ConversationMessage & SenderCarrier;
  const raw = (carrier.sent_by ?? carrier.sentBy) as { kind?: unknown; id?: unknown } | null | undefined;
  const kind = typeof raw?.kind === "string" ? raw.kind : "";
  if (!SENDER_KINDS.includes(kind as SenderKind)) return null;
  return { kind: kind as SenderKind, id: typeof raw?.id === "string" ? raw.id : "" };
}
