export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

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

export function attachmentProblem(current: number, file: FileLike): AttachmentProblem | null {
  if (current >= MAX_ATTACHMENTS) return "tooMany";
  if (file.size === 0) return "empty";
  if (file.size > MAX_ATTACHMENT_BYTES) return "tooLarge";
  return null;
}
