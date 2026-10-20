import type { DraftAttachment } from "./drafts";
import type { MediaType } from "./types";

export type AttachmentStatus = "uploading" | "ready" | "failed";

export interface ComposerAttachment {
  localId: string;
  name: string;
  size: number;
  type: MediaType;
  status: AttachmentStatus;
  previewUrl?: string;
  mediaId?: string;
  error?: string;
}

export type OutgoingPart = (
  | { kind: "text"; text: string }
  | { kind: "media"; mediaId: string; mediaType: MediaType; caption: string }
) & { replyToMessageId?: string };

type ReadyAttachment = ComposerAttachment & { mediaId: string };

const CAPTIONLESS: readonly MediaType[] = ["audio", "sticker"];

export function acceptsCaption(type: MediaType): boolean {
  return !CAPTIONLESS.includes(type);
}

function isReady(attachment: ComposerAttachment): attachment is ReadyAttachment {
  return attachment.status === "ready" && Boolean(attachment.mediaId);
}

export function attachmentsReady(attachments: readonly ComposerAttachment[]): boolean {
  return attachments.every(isReady);
}

export function hasCaptionTarget(attachments: readonly ComposerAttachment[]): boolean {
  return attachments.length === 0 || attachments.some((attachment) => acceptsCaption(attachment.type));
}

export function planOutgoing(
  text: string,
  attachments: readonly ComposerAttachment[],
  replyToMessageId?: string,
): OutgoingPart[] {
  const trimmed = text.trim();
  const sendable = attachments.filter(isReady);
  const captionIndex = sendable.findIndex((attachment) => acceptsCaption(attachment.type));
  const parts: OutgoingPart[] = sendable.map((attachment, index) => ({
    kind: "media",
    mediaId: attachment.mediaId,
    mediaType: attachment.type,
    caption: index === captionIndex ? trimmed : "",
  }));
  if (trimmed && captionIndex === -1) parts.push({ kind: "text", text: trimmed });
  if (!replyToMessageId || parts.length === 0) return parts;
  const [first, ...rest] = parts;
  return [{ ...first, replyToMessageId }, ...rest];
}

export function toDraftAttachments(attachments: readonly ComposerAttachment[]): DraftAttachment[] {
  return attachments.filter(isReady).map(({ mediaId, type, name, size }) => ({ mediaId, type, name, size }));
}

export function fromDraftAttachments(attachments: readonly DraftAttachment[]): ComposerAttachment[] {
  return attachments.map(({ mediaId, type, name, size }) => ({ localId: mediaId, mediaId, type, name, size, status: "ready" }));
}
