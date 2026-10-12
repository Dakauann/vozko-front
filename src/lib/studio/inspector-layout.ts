export const INSPECTOR_GROUPS = ["basic", "animation", "color", "effects", "cutout", "speed"] as const;

export type InspectorGroupId = (typeof INSPECTOR_GROUPS)[number];

export const DEFAULT_INSPECTOR_GROUP: InspectorGroupId = "basic";

export const MAX_REMEMBERED_SECTIONS = 200;

export function isInspectorGroup(value: unknown): value is InspectorGroupId {
  return typeof value === "string" && (INSPECTOR_GROUPS as readonly string[]).includes(value);
}

export function presentGroups(assigned: Iterable<InspectorGroupId>): InspectorGroupId[] {
  const found = new Set(assigned);
  return INSPECTOR_GROUPS.filter((group) => found.has(group));
}

export function activeGroup(present: readonly InspectorGroupId[], preferred: InspectorGroupId | null): InspectorGroupId | null {
  if (preferred !== null && present.includes(preferred)) return preferred;
  return present[0] ?? null;
}

export function parseOpenSections(raw: string | null): Record<string, boolean> {
  if (raw === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"));
}

export function rememberSection(open: Readonly<Record<string, boolean>>, id: string, value: boolean): Record<string, boolean> {
  const entries = Object.entries(open).filter(([key]) => key !== id);
  entries.push([id, value]);
  return Object.fromEntries(entries.slice(-MAX_REMEMBERED_SECTIONS));
}

export function searchText(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().trim();
}

export function matchesSearch(query: string, texts: readonly string[]): boolean {
  const wanted = searchText(query);
  return wanted === "" || texts.some((text) => searchText(text).includes(wanted));
}
