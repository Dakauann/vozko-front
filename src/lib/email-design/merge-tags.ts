import { MAX_FALLBACK_RUNES } from "./limits";

export const CONTACT_TAGS = ["first_name", "name", "email", "company"] as const;

export type ContactTag = (typeof CONTACT_TAGS)[number];

export interface CustomField {
  key: string;
  label: string;
}

export type MergeTagOption = { group: "contact"; tag: ContactTag } | { group: "field"; tag: string; key: string; label: string };

const FIELD_KEY = /^[a-z0-9_]+$/;
const FALLBACK_FORBIDDEN = /[|{}\r\n]/g;

export function mergeTagCatalog(customFields: readonly CustomField[] = []): MergeTagOption[] {
  const seen = new Set<string>();
  const fields: MergeTagOption[] = [];
  for (const field of customFields) {
    if (!FIELD_KEY.test(field.key) || seen.has(field.key)) continue;
    seen.add(field.key);
    fields.push({ group: "field", tag: `field.${field.key}`, key: field.key, label: field.label || field.key });
  }
  return [...CONTACT_TAGS.map((tag): MergeTagOption => ({ group: "contact", tag })), ...fields];
}

export function cleanFallback(fallback: string): string {
  return Array.from(fallback.replace(FALLBACK_FORBIDDEN, "")).slice(0, MAX_FALLBACK_RUNES).join("");
}

export function formatMergeTag(tag: string, fallback?: string): string {
  const clean = cleanFallback(fallback ?? "");
  return clean.trim() === "" ? `{{${tag}}}` : `{{${tag}|${clean}}}`;
}

export function insertAtCaret(text: string, start: number, end: number, insertion: string): { text: string; caret: number } {
  const from = Math.max(0, Math.min(start, end, text.length));
  const to = Math.min(text.length, Math.max(start, end, from));
  return { text: text.slice(0, from) + insertion + text.slice(to), caret: from + insertion.length };
}
