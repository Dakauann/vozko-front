import type { AnalysableCommentSource } from "@/lib/audience/types";
import type { AttachmentRule, TextLimit } from "@/lib/conversations/types";
import type { ResourceType } from "@/lib/workspace/types";

export const TIKTOK_ENTRY_TYPE = "tiktok";

export const TIKTOK_RESOURCE: ResourceType = "tiktok_accounts";

export const TIKTOK_COMMENT_SOURCE: AnalysableCommentSource = "tiktok";

export const TIKTOK_TEXT_LIMIT: TextLimit = { max: 6000, unit: "characters" };

export const TIKTOK_DISCLOSURE_LIMIT: TextLimit = { max: 500, unit: "characters" };

export const TIKTOK_COMMENT_REPLY_LIMIT: TextLimit = { max: 1200, unit: "characters" };

export const TIKTOK_ATTACHMENTS: AttachmentRule = {
  mimeTypes: ["image/jpeg", "image/png"],
  extensions: [".jpg", ".jpeg", ".png"],
  kinds: ["JPG", "PNG"],
  maxBytes: 3 * 1024 * 1024,
  voiceNotes: false,
};
