export const MIME_GROUPS = ["pdf", "word", "excel", "powerpoint", "images", "text", "video", "archives", "other"] as const;

export type MimeGroup = (typeof MIME_GROUPS)[number];

export interface MimeGroupTypes {
  group: MimeGroup;
  types: string[];
}

export type GroupState = "all" | "some" | "none";

const EXACT: Record<string, MimeGroup> = {
  "application/pdf": "pdf",
  "application/msword": "word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
  "application/vnd.oasis.opendocument.text": "word",
  "application/vnd.ms-excel": "excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
  "application/vnd.oasis.opendocument.spreadsheet": "excel",
  "application/vnd.ms-powerpoint": "powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "powerpoint",
  "application/vnd.oasis.opendocument.presentation": "powerpoint",
  "application/gzip": "archives",
  "application/zip": "archives",
  "application/x-7z-compressed": "archives",
};

function groupOf(type: string): MimeGroup {
  const exact = EXACT[type];
  if (exact) return exact;
  if (type.startsWith("image/")) return "images";
  if (type.startsWith("text/")) return "text";
  if (type.startsWith("video/")) return "video";
  return "other";
}

export function groupMimeTypes(allowed: readonly string[]): MimeGroupTypes[] {
  return MIME_GROUPS.map((group) => ({ group, types: allowed.filter((type) => groupOf(type) === group) })).filter((entry) => entry.types.length > 0);
}

export function groupState(selected: readonly string[] | undefined, types: readonly string[]): GroupState {
  const picked = types.filter((type) => selected?.includes(type)).length;
  if (picked === 0) return "none";
  return picked === types.length ? "all" : "some";
}

export function toggleGroup(selected: readonly string[] | undefined, types: readonly string[], on: boolean, allowed: readonly string[]): string[] {
  const next = new Set(selected ?? []);
  for (const type of types) {
    if (on) next.add(type);
    else next.delete(type);
  }
  const ordered = allowed.filter((type) => next.has(type));
  const extra = [...next].filter((type) => !allowed.includes(type));
  return [...ordered, ...extra];
}
