import type { ConversationMessage } from "@/lib/conversations/types";

export function emailCampaignName(message: Pick<ConversationMessage, "metadata" | "channel" | "entry_type">): string | null {
  if ((message.channel ?? message.entry_type) !== "email") return null;
  const value = (message.metadata as Record<string, unknown> | undefined)?.email_campaign_name;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
