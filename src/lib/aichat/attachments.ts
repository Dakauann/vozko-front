import type { ChatAttachment, ChatImage } from "./types";

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const IMAGE_KIND = "image";

export type AttachmentProblem = "tooMany" | "tooLarge" | "empty";

interface FileLike {
  name: string;
  type: string;
  size: number;
}

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export function mediaTypeFor(file: FileLike): string {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  const ext = extension(file.name);
  if (file.type === "application/pdf" || ext === "pdf") return "document_pdf";
  if (ext === "doc" || ext === "docx") return "document_doc";
  return "document";
}

export function roomProblem(current: number): AttachmentProblem | null {
  return current >= MAX_ATTACHMENTS ? "tooMany" : null;
}

export function attachmentProblem(current: number, file: FileLike): AttachmentProblem | null {
  const room = roomProblem(current);
  if (room) return room;
  if (file.size === 0) return "empty";
  if (file.size > MAX_ATTACHMENT_BYTES) return "tooLarge";
  return null;
}

type ShownImage = ChatAttachment & { url: string };

export function isShownImage(attachment: ChatAttachment): attachment is ShownImage {
  return attachment.kind === IMAGE_KIND && Boolean(attachment.url);
}

export function imageAttachments(attachments: ChatAttachment[]): ShownImage[] {
  return attachments.filter(isShownImage);
}

export function attachmentOfImage(image: ChatImage): ChatAttachment {
  return { mediaId: image.mediaId, name: image.alt, kind: IMAGE_KIND, url: image.url };
}
