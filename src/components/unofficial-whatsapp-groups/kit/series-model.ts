import type { SeriesSibling } from "@/lib/unofficial-whatsapp-groups/types";

export interface ConflictGroup {
  subject: string;
  groupId?: string;
}

const CONFLICT_SEPARATOR = ": ";

const CONFLICT_PREFIX = "some groups of the series could not be updated";

export function parseSeriesConflict(error: string, series: SeriesSibling[]): ConflictGroup[] | null {
  const marker = `${CONFLICT_PREFIX}${CONFLICT_SEPARATOR}`;
  const at = error.toLowerCase().indexOf(marker);
  if (at < 0) return null;
  const subjects = error
    .slice(at + marker.length)
    .split(", ")
    .map((subject) => subject.trim())
    .filter(Boolean);
  if (subjects.length === 0) return null;
  const used = new Set<string>();
  return subjects.map((subject) => {
    const sibling = series.find((candidate) => candidate.subject.trim() === subject && !used.has(candidate.groupId));
    if (!sibling) return { subject };
    used.add(sibling.groupId);
    return { subject, groupId: sibling.groupId };
  });
}

export function seriesName(baseName: string, sequence: number): string {
  return `${baseName.trim()} #${sequence}`;
}

export function seriesRenames(baseName: string, series: SeriesSibling[]): { groupId: string; from: string; to: string }[] {
  return [...series]
    .sort((a, b) => a.sequence - b.sequence)
    .map((sibling) => ({ groupId: sibling.groupId, from: sibling.subject, to: seriesName(baseName, sibling.sequence) }));
}
