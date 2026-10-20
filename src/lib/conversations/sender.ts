import type { ConversationMessage } from "@/lib/conversations/types";

export type SenderKind = "contact" | "human" | "ai" | "workflow" | "campaign" | "external" | "system";

type MessageSender = { kind: SenderKind; id: string };

const SENDER_KINDS: readonly SenderKind[] = ["contact", "human", "ai", "workflow", "campaign", "external", "system"];

type SenderCarrier = { sent_by?: unknown; sentBy?: unknown };

export function readSenderKind(raw: unknown): SenderKind | undefined {
  return typeof raw === "string" && SENDER_KINDS.includes(raw as SenderKind) ? (raw as SenderKind) : undefined;
}

export function senderOf(message: ConversationMessage): MessageSender | null {
  const carrier = message as ConversationMessage & SenderCarrier;
  const raw = (carrier.sent_by ?? carrier.sentBy) as { kind?: unknown; id?: unknown } | null | undefined;
  const kind = readSenderKind(raw?.kind);
  if (!kind) return null;
  return { kind, id: typeof raw?.id === "string" ? raw.id : "" };
}
