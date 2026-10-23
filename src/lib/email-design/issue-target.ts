import type { Hint, Issue } from "./types";

export interface IssueTarget {
  blockId: string | null;
  field: string | null;
}

export const TEXT_CONTENT_FIELD = "paragraphs";

const HINT_FIELDS: Record<string, string> = {
  image_missing_alt: "alt",
  preheader_missing: "settings.preheader",
};

export function fieldKey(field: string | undefined): string | null {
  if (!field) return null;
  if (field === TEXT_CONTENT_FIELD || field.startsWith(`${TEXT_CONTENT_FIELD}.`)) return TEXT_CONTENT_FIELD;
  if (field === "version" || field === "blocks" || field === "subject") return null;
  return field;
}

export function issueTarget(issue: Issue): IssueTarget {
  return { blockId: issue.block_id || null, field: fieldKey(issue.field) };
}

export function hintTarget(hint: Hint): IssueTarget {
  return { blockId: hint.block_id || null, field: HINT_FIELDS[hint.code] ?? null };
}

export function isSettingsField(field: string | null): boolean {
  return field !== null && field.startsWith("settings.");
}
