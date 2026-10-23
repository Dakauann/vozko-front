import type { SenderKind } from "@/lib/conversations/sender";
import type { EntryType } from "@/lib/conversations/types";
import { refuseUnhandled } from "@/lib/exhaustive";

export const SENDER_LABEL_CHANNELS: readonly EntryType[] = [
  "whatsapp",
  "unofficial_whatsapp",
  "instagram",
  "facebook",
  "telegram",
  "webchat",
  "mercadolivre",
  "tiktok",
  "email",
  "rcs",
  "sms",
];

export type SenderLabelKey =
  | "messageSender.human"
  | "messageSender.ai"
  | "messageSender.workflow"
  | "messageSender.campaign"
  | "messageSender.system"
  | "messageSender.external"
  | `messageSender.externalVia.${EntryType}`;

function externalSenderKey(channel: string | undefined): SenderLabelKey {
  const known = SENDER_LABEL_CHANNELS.find((candidate) => candidate === channel);
  return known ? `messageSender.externalVia.${known}` : "messageSender.external";
}

export function senderLabelKey(kind: SenderKind | undefined, channel: string | undefined): SenderLabelKey | null {
  if (!kind) return null;
  switch (kind) {
    case "contact":
      return null;
    case "human":
    case "ai":
    case "workflow":
    case "campaign":
    case "system":
      return `messageSender.${kind}`;
    case "external":
      return externalSenderKey(channel);
    default:
      return refuseUnhandled(kind, null);
  }
}
