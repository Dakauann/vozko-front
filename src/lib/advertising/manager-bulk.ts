import type { AdBulkChange, AdBulkField, AdBulkResult, AdLevel, AdRow } from "./types";

const GENERAL_FIELDS: AdBulkField[] = ["name"];

export type CreativeField = Exclude<AdBulkField, "name">;

export const CREATIVE_FIELDS: CreativeField[] = ["primaryText", "headline", "description", "link"];

export type BulkMode = AdBulkChange["mode"];

export interface BulkForm {
  field: AdBulkField;
  mode: BulkMode;
  value: string;
  find: string;
  replace: string;
  matchCase: boolean;
}

export type BulkFormProblem = "fieldNotForLevel" | "valueRequired" | "findRequired";

export interface BulkOutcome {
  metaId: string;
  ok: boolean;
  object: AdRow | undefined;
  message: string | null;
}

export function bulkFieldsFor(level: AdLevel): AdBulkField[] {
  return level === "ad" ? [...GENERAL_FIELDS, ...CREATIVE_FIELDS] : [...GENERAL_FIELDS];
}

export function isCreativeField(field: string): field is CreativeField {
  return (CREATIVE_FIELDS as string[]).includes(field);
}

export function bulkChangeOf(form: BulkForm, level: AdLevel): { change: AdBulkChange } | { problem: BulkFormProblem } {
  if (!bulkFieldsFor(level).includes(form.field)) return { problem: "fieldNotForLevel" };
  if (form.mode === "replace") {
    if (!form.find) return { problem: "findRequired" };
    return { change: { field: form.field, mode: "replace", find: form.find, replace: form.replace, matchCase: form.matchCase } };
  }
  const value = form.value.trim();
  if (!value && form.field === "name") return { problem: "valueRequired" };
  return { change: { field: form.field, mode: "set", value } };
}

export function bulkOutcomes(requested: string[], results: AdBulkResult[]): BulkOutcome[] {
  const byId = new Map(results.map((result) => [result.metaId, result]));
  return requested.map((metaId) => {
    const result = byId.get(metaId);
    return { metaId, ok: result?.ok === true, object: result?.object, message: result?.error?.message || null };
  });
}

export function bulkTally(outcomes: { ok: boolean }[]): { ok: number; failed: number } {
  const ok = outcomes.filter((outcome) => outcome.ok).length;
  return { ok, failed: outcomes.length - ok };
}
