import type { ActiveConversation, ChannelMediaLimit, EntryType } from "@/lib/conversations/types";

const MB = 1024 * 1024;

export const MEDIA_LIMITS_BY_CHANNEL: Record<EntryType, ChannelMediaLimit[]> = {
  whatsapp: [
    { kind: "audio", max_bytes: 16 * MB, mime_types: [] },
    { kind: "document", max_bytes: 100 * MB, mime_types: ["application/pdf", "text/plain"] },
    { kind: "image", max_bytes: 5 * MB, mime_types: ["image/jpeg", "image/png"] },
    { kind: "video", max_bytes: 16 * MB, mime_types: ["video/3gpp", "video/mp4"] },
  ],
  unofficial_whatsapp: [
    { kind: "audio", max_bytes: 16 * MB, mime_types: ["audio/ogg", "audio/wav", "audio/webm"] },
    { kind: "document", max_bytes: 100 * MB, mime_types: [] },
    { kind: "image", max_bytes: 16 * MB, mime_types: ["image/jpeg", "image/png", "image/webp"] },
    { kind: "video", max_bytes: 16 * MB, mime_types: ["video/3gpp", "video/mp4"] },
  ],
  instagram: [
    { kind: "audio", max_bytes: 25 * MB, mime_types: ["audio/aac", "audio/m4a", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"] },
    { kind: "document", max_bytes: 25 * MB, mime_types: ["application/pdf"] },
    { kind: "image", max_bytes: 8 * MB, mime_types: ["image/jpeg", "image/png"] },
    { kind: "video", max_bytes: 25 * MB, mime_types: ["video/mp4"] },
  ],
  facebook: [
    { kind: "audio", max_bytes: 25 * MB, mime_types: ["audio/mpeg", "audio/wav"] },
    { kind: "document", max_bytes: 25 * MB, mime_types: [] },
    { kind: "image", max_bytes: 8 * MB, mime_types: ["image/gif", "image/jpeg", "image/png"] },
    { kind: "video", max_bytes: 25 * MB, mime_types: ["video/mp4"] },
  ],
  telegram: [
    { kind: "audio", max_bytes: 50 * MB, mime_types: ["audio/ogg", "audio/wav"] },
    { kind: "document", max_bytes: 50 * MB, mime_types: [] },
    { kind: "image", max_bytes: 10 * MB, mime_types: ["image/jpeg", "image/png"] },
    { kind: "video", max_bytes: 50 * MB, mime_types: ["video/mp4"] },
  ],
  webchat: [
    { kind: "audio", max_bytes: 25 * MB, mime_types: [] },
    { kind: "document", max_bytes: 50 * MB, mime_types: [] },
    { kind: "image", max_bytes: 10 * MB, mime_types: ["image/gif", "image/jpeg", "image/png", "image/webp"] },
    { kind: "video", max_bytes: 50 * MB, mime_types: [] },
  ],
  mercadolivre: [
    { kind: "document", max_bytes: 25 * MB, mime_types: ["application/pdf", "text/plain"] },
    { kind: "image", max_bytes: 25 * MB, mime_types: ["image/jpeg", "image/png"] },
  ],
  tiktok: [{ kind: "image", max_bytes: 3 * MB, mime_types: ["image/jpeg", "image/png"] }],
  email: [],
  rcs: [
    { kind: "image", max_bytes: 100 * MB, mime_types: ["image/jpeg", "image/png", "image/gif"] },
    { kind: "video", max_bytes: 100 * MB, mime_types: ["video/mp4", "video/mpeg", "video/webm", "video/h263", "video/m4v"] },
    { kind: "audio", max_bytes: 100 * MB, mime_types: ["audio/aac", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/ogg", "audio/3gpp"] },
    { kind: "document", max_bytes: 100 * MB, mime_types: ["application/pdf"] },
  ],
  sms: [],
};

export function subscribedConversation(
  entryId: string,
  entryType: EntryType,
  mediaLimits: readonly ChannelMediaLimit[] | "unknown" = MEDIA_LIMITS_BY_CHANNEL[entryType],
): ActiveConversation {
  return {
    entry_id: entryId,
    entry_type: entryType,
    lead_name: "Contato",
    lead_number: "",
    messages: [],
    has_more: false,
    unread_count: 0,
    window_open: true,
    window_expires_at: null,
    media_limits: mediaLimits === "unknown" ? undefined : mediaLimits,
  };
}

export function crmShowing(conversation: ActiveConversation | null) {
  return { activeConversation: conversation, windowConversations: new Map(), inbox: [], runMessageAction: () => true };
}
