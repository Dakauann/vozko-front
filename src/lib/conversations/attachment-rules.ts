import { mediaTypeForFile } from "./media";
import type { ChannelMediaKind, ChannelMediaLimit, EntryType } from "./types";

export type ChannelMediaLimits = readonly ChannelMediaLimit[];

export type AttachmentRefusal =
  | { reason: "unknown" }
  | { reason: "none" }
  | { reason: "type" }
  | { reason: "size"; maxBytes: number };

export type AttachmentTypeName = { kind: ChannelMediaKind } | { format: string };

export const ATTACHMENT_KINDS: readonly ChannelMediaKind[] = ["image", "video", "audio", "document"];

const BYTES_PER_MEGABYTE = 1024 * 1024;

const AUDIO_TRANSCODED_BY_SERVER: ReadonlySet<EntryType> = new Set<EntryType>(["whatsapp", "unofficial_whatsapp"]);

interface KnownFormat {
  name: string;
  extensions: readonly string[];
}

const KNOWN_FORMATS: Readonly<Record<string, KnownFormat>> = {
  "image/jpeg": { name: "JPG", extensions: [".jpg", ".jpeg"] },
  "image/png": { name: "PNG", extensions: [".png"] },
  "image/gif": { name: "GIF", extensions: [".gif"] },
  "image/webp": { name: "WEBP", extensions: [".webp"] },
  "video/mp4": { name: "MP4", extensions: [".mp4"] },
  "video/3gpp": { name: "3GP", extensions: [".3gp"] },
  "video/quicktime": { name: "MOV", extensions: [".mov"] },
  "video/webm": { name: "WEBM", extensions: [".webm"] },
  "video/x-msvideo": { name: "AVI", extensions: [".avi"] },
  "video/ogg": { name: "OGV", extensions: [".ogv"] },
  "audio/mpeg": { name: "MP3", extensions: [".mp3"] },
  "audio/mp4": { name: "M4A", extensions: [".m4a"] },
  "audio/m4a": { name: "M4A", extensions: [".m4a"] },
  "audio/x-m4a": { name: "M4A", extensions: [".m4a"] },
  "audio/aac": { name: "AAC", extensions: [".aac"] },
  "audio/wav": { name: "WAV", extensions: [".wav"] },
  "audio/x-wav": { name: "WAV", extensions: [".wav"] },
  "audio/ogg": { name: "OGG", extensions: [".ogg", ".oga"] },
  "audio/opus": { name: "OPUS", extensions: [".opus"] },
  "audio/amr": { name: "AMR", extensions: [".amr"] },
  "audio/webm": { name: "WEBM", extensions: [".weba"] },
  "audio/3gpp": { name: "3GP", extensions: [".3gp"] },
  "application/pdf": { name: "PDF", extensions: [".pdf"] },
  "text/plain": { name: "TXT", extensions: [".txt"] },
  "application/msword": { name: "DOC", extensions: [".doc"] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { name: "DOCX", extensions: [".docx"] },
  "application/vnd.ms-excel": { name: "XLS", extensions: [".xls"] },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { name: "XLSX", extensions: [".xlsx"] },
  "application/vnd.ms-powerpoint": { name: "PPT", extensions: [".ppt"] },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { name: "PPTX", extensions: [".pptx"] },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMediaKind(value: string): value is ChannelMediaKind {
  return (ATTACHMENT_KINDS as readonly string[]).includes(value);
}

function baseMimeType(type: string): string {
  return type.split(";")[0].trim().toLowerCase();
}

type ParsedLimit = ChannelMediaLimit | "skip" | "malformed";

function readMediaLimit(raw: unknown): ParsedLimit {
  if (!isRecord(raw)) return "malformed";
  const { kind, max_bytes: maxBytes, mime_types: mimeTypes } = raw;
  if (typeof kind !== "string") return "malformed";
  if (typeof maxBytes !== "number" || !Number.isFinite(maxBytes) || maxBytes <= 0) return "malformed";
  if (!Array.isArray(mimeTypes) || !mimeTypes.every((type) => typeof type === "string")) return "malformed";
  if (!isMediaKind(kind)) return "skip";
  return { kind, max_bytes: maxBytes, mime_types: mimeTypes.map(baseMimeType) };
}

export function readMediaLimits(raw: unknown): ChannelMediaLimits | undefined {
  if (!Array.isArray(raw)) return undefined;
  const limits: ChannelMediaLimit[] = [];
  for (const item of raw) {
    const parsed = readMediaLimit(item);
    if (parsed === "malformed") return undefined;
    if (parsed !== "skip") limits.push(parsed);
  }
  return limits;
}

export function composerMediaLimits(entryType: EntryType, limits: ChannelMediaLimits | undefined): ChannelMediaLimits | undefined {
  if (!limits || !AUDIO_TRANSCODED_BY_SERVER.has(entryType)) return limits;
  return limits.map((limit) =>
    limit.kind === "audio" ? { kind: "audio", max_bytes: Number.POSITIVE_INFINITY, mime_types: [] } : limit,
  );
}

function limitFor(limits: ChannelMediaLimits, kind: ChannelMediaKind): ChannelMediaLimit | undefined {
  return limits.find((limit) => limit.kind === kind);
}

function inKindOrder(limits: ChannelMediaLimits): ChannelMediaLimit[] {
  return ATTACHMENT_KINDS.map((kind) => limitFor(limits, kind)).filter((limit): limit is ChannelMediaLimit => limit !== undefined);
}

export function attachmentRefusal(file: File, limits: ChannelMediaLimits | undefined): AttachmentRefusal | null {
  if (!limits) return { reason: "unknown" };
  if (limits.length === 0) return { reason: "none" };
  const kind = mediaTypeForFile(file);
  const limit = isMediaKind(kind) ? limitFor(limits, kind) : undefined;
  if (!limit) return { reason: "type" };
  if (limit.mime_types.length > 0 && !limit.mime_types.includes(baseMimeType(file.type))) return { reason: "type" };
  if (file.size > limit.max_bytes) return { reason: "size", maxBytes: limit.max_bytes };
  return null;
}

export function acceptsAttachments(limits: ChannelMediaLimits | undefined): boolean {
  return Boolean(limits && limits.length > 0);
}

export function acceptsVoiceNotes(limits: ChannelMediaLimits | undefined): boolean {
  return Boolean(limits && limitFor(limits, "audio"));
}

export function attachmentAccept(limits: ChannelMediaLimits | undefined): string {
  if (!limits) return "";
  const ordered = inKindOrder(limits);
  if (ordered.some((limit) => limit.kind === "document" && limit.mime_types.length === 0)) return "";
  const extensions = ordered.flatMap((limit) => limit.mime_types.flatMap((type) => KNOWN_FORMATS[type]?.extensions ?? []));
  const types = ordered.flatMap((limit) => (limit.mime_types.length === 0 ? [`${limit.kind}/*`] : limit.mime_types));
  return [...new Set([...extensions, ...types])].join(",");
}

export function attachmentTypeNames(limits: ChannelMediaLimits | undefined): AttachmentTypeName[] {
  if (!limits) return [];
  const names: AttachmentTypeName[] = [];
  const seen = new Set<string>();
  for (const limit of inKindOrder(limits)) {
    if (limit.mime_types.length === 0) {
      names.push({ kind: limit.kind });
      continue;
    }
    for (const type of limit.mime_types) {
      const format = KNOWN_FORMATS[type]?.name ?? type;
      if (seen.has(format)) continue;
      seen.add(format);
      names.push({ format });
    }
  }
  return names;
}

export function attachmentMegabytes(maxBytes: number): number {
  return Math.floor(maxBytes / BYTES_PER_MEGABYTE);
}
