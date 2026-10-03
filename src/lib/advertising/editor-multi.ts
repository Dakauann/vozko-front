import {
  EDIT_GROUP_FIELDS,
  editFormOf,
  editGroupsFor,
  editInputProblems,
  editIsEmpty,
  fieldChanged,
  fieldEdit,
  sameValue,
  type EditForm,
  type EditGroup,
  type EditInputProblem,
} from "./edit";
import { creativeText, objectAnalysis, type AnalysisValue } from "./editor-analysis";
import { CREATIVE_FIELDS, bulkChangeOf, isCreativeField, type BulkOutcome, type CreativeField } from "./manager-bulk";
import { isDraftKey } from "./manager-drafts";
import { MAX_BULK_OBJECTS } from "./manager-toolbar";
import type { AdBulkChange, AdEditableObject, AdLevel, AdObjectEdit, AdRow } from "./types";

const MIN_MULTI_OBJECTS = 2;

export type MultiGroup = EditGroup | CreativeField;

export type MultiBlocker = "missing" | "budgetShape" | "goal" | "destination";

interface MultiTarget {
  accountId: string;
  metaIds: string[];
}

export interface ObjectValue<T> {
  metaId: string;
  name: string;
  value: T;
}

export type FieldState<T> = { kind: "same"; value: T } | { kind: "mixed"; values: ObjectValue<T>[] };

export interface MultiValues {
  form: EditForm;
  text: Record<CreativeField, string>;
}

export interface MultiObject extends MultiValues {
  detail: AdEditableObject;
}

export interface MultiField {
  group: MultiGroup;
  state: FieldState<unknown>;
  blocker: MultiBlocker | null;
}

export interface LoadedObject {
  metaId: string;
  detail: AdEditableObject | null;
  message: string | null;
}

export interface LoadEntry {
  metaId: string;
  name: string | null;
  ok: boolean;
  message: string | null;
}

type MultiLoad =
  | { kind: "ready"; level: AdLevel; objects: AdEditableObject[] }
  | { kind: "failed"; reason: "load" | "level"; entries: LoadEntry[] };

interface MultiCrumb {
  level: AdLevel;
  count: number;
}

export interface MultiSavePlan {
  edit: AdObjectEdit;
  changes: AdBulkChange[];
}

export interface MultiFact {
  key: string;
  state: FieldState<AnalysisValue>;
}

export interface MultiEditInput {
  level: AdLevel;
  fields: MultiField[];
  opened: MultiGroup[];
  first: MultiValues;
  current: MultiValues;
  timezone: string;
  currency: string;
}

const PROBLEM_GROUPS: Record<EditInputProblem, MultiGroup> = {
  name: "name",
  budget: "budgetBid",
  bidAmount: "budgetBid",
  roasFloor: "budgetBid",
};

export function parseMultiTarget(objects: string | null, account: string | null): MultiTarget | null {
  if (!objects || !account) return null;
  const metaIds = objects.split(",").map((id) => id.trim());
  if (metaIds.some((id) => !id || isDraftKey(id))) return null;
  if (new Set(metaIds).size !== metaIds.length) return null;
  if (metaIds.length < MIN_MULTI_OBJECTS || metaIds.length > MAX_BULK_OBJECTS) return null;
  return { accountId: account, metaIds };
}

export function multiLoad(loaded: LoadedObject[]): MultiLoad {
  const entries = loaded.map(({ metaId, detail, message }) => {
    const ok = detail !== null && detail.row.metaId === metaId;
    return { metaId, name: detail?.row.name ?? null, ok, message: ok ? null : message };
  });
  if (loaded.length < MIN_MULTI_OBJECTS || entries.some((entry) => !entry.ok)) return { kind: "failed", reason: "load", entries };
  const objects = loaded.map(({ detail }) => detail as AdEditableObject);
  const level = objects[0].row.level;
  if (objects.some((object) => object.row.level !== level)) return { kind: "failed", reason: "level", entries };
  return { kind: "ready", level, objects };
}

export function fieldState<T>(values: ObjectValue<T>[]): FieldState<T> {
  const [first] = values;
  if (first && values.every((entry) => sameValue(entry.value, first.value))) return { kind: "same", value: first.value };
  return { kind: "mixed", values };
}

export function multiObjects(details: AdEditableObject[], timezone: string, catalog: Record<string, string[]>, currency: string): MultiObject[] {
  return details.map((detail) => ({
    detail,
    form: editFormOf(detail, timezone, catalog, currency),
    text: Object.fromEntries(CREATIVE_FIELDS.map((field) => [field, creativeText(detail.creative, field)])) as Record<CreativeField, string>,
  }));
}

function groupValue(group: MultiGroup, values: MultiValues): unknown {
  if (isCreativeField(group)) return values.text[group].trim();
  if (group === "name") return values.form.name.trim();
  return EDIT_GROUP_FIELDS[group].map((field) => values.form[field]);
}

function differs(values: unknown[]): boolean {
  return values.some((value) => !sameValue(value, values[0]));
}

function groupBlocker(group: MultiGroup, objects: MultiObject[]): MultiBlocker | null {
  switch (group) {
    case "budgetBid":
      if (objects.some((object) => !object.form.bid)) return "missing";
      if (differs(objects.map((object) => object.form.budget?.kind ?? null))) return "budgetShape";
      if (differs(objects.map((object) => object.detail.row.optimizationGoal ?? ""))) return "goal";
      return null;
    case "targeting":
      return objects.some((object) => !object.form.targeting) ? "missing" : null;
    case "placements":
      if (objects.some((object) => !object.form.placements)) return "missing";
      return differs(objects.map((object) => object.detail.row.destinationType ?? "")) ? "destination" : null;
    default:
      return null;
  }
}

export function scheduleOffered(objects: MultiObject[]): boolean {
  return objects.every((object) => object.form.budget?.kind === "LIFETIME");
}

function multiGroups(level: AdLevel, objects: MultiObject[]): MultiGroup[] {
  const groups: MultiGroup[] = editGroupsFor(level).filter((group) => group !== "schedule" || scheduleOffered(objects));
  return level === "ad" ? [...groups, ...CREATIVE_FIELDS] : groups;
}

export function multiFields(level: AdLevel, objects: MultiObject[]): MultiField[] {
  return multiGroups(level, objects).map((group) => ({
    group,
    state: fieldState(objects.map((object) => ({ metaId: object.detail.row.metaId, name: object.detail.row.name, value: groupValue(group, object) }))),
    blocker: groupBlocker(group, objects),
  }));
}

export function resetGroup(group: MultiGroup, current: MultiValues, first: MultiValues): MultiValues {
  if (isCreativeField(group)) return { ...current, text: { ...current.text, [group]: first.text[group] } };
  const form = EDIT_GROUP_FIELDS[group].reduce<EditForm>((next, field) => ({ ...next, [field]: first.form[field] }), current.form);
  return { ...current, form };
}

export function activeGroups({ fields, opened, first, current }: Pick<MultiEditInput, "fields" | "opened" | "first" | "current">): MultiGroup[] {
  return fields
    .filter((field) => field.blocker === null)
    .filter((field) =>
      field.state.kind === "mixed" ? opened.includes(field.group) : !sameValue(groupValue(field.group, current), groupValue(field.group, first)),
    )
    .map((field) => field.group);
}

export function multiProblems(input: MultiEditInput): EditInputProblem[] {
  const active = activeGroups(input);
  return editInputProblems(input.current.form, input.currency).filter((problem) => active.includes(PROBLEM_GROUPS[problem]));
}

export function multiSavePlan(input: MultiEditInput): MultiSavePlan {
  const { level, fields, first, current, timezone, currency } = input;
  const plan: MultiSavePlan = { edit: {}, changes: [] };
  const mixed = new Set(fields.filter((field) => field.state.kind === "mixed").map((field) => field.group));
  for (const group of activeGroups(input)) {
    if (isCreativeField(group)) {
      const parsed = bulkChangeOf({ field: group, mode: "set", value: current.text[group], find: "", replace: "", matchCase: false }, level);
      if ("change" in parsed) plan.changes.push(parsed.change);
      continue;
    }
    EDIT_GROUP_FIELDS[group]
      .filter((field) => mixed.has(group) || fieldChanged(field, first.form, current.form, timezone, currency))
      .forEach((field) => Object.assign(plan.edit, fieldEdit(field, first.form, current.form, timezone, currency)));
  }
  return plan;
}

export function planIsEmpty(plan: MultiSavePlan): boolean {
  return editIsEmpty(plan.edit) && plan.changes.length === 0;
}

export function failedOutcomes(requested: string[], message: string): BulkOutcome[] {
  return requested.map((metaId) => ({ metaId, ok: false, object: undefined, message }));
}

export function mergeOutcomes(requested: string[], runs: BulkOutcome[][]): BulkOutcome[] {
  return requested.map((metaId) => {
    const mine = runs.map((run) => run.find((outcome) => outcome.metaId === metaId) ?? { metaId, ok: false, object: undefined, message: null });
    const failed = mine.find((outcome) => !outcome.ok);
    const object = [...mine].reverse().find((outcome) => outcome.object)?.object;
    return { metaId, ok: mine.length > 0 && !failed, object, message: failed?.message ?? null };
  });
}

export function withOutcomes(objects: AdEditableObject[], outcomes: BulkOutcome[]): AdEditableObject[] {
  const rows = new Map(outcomes.filter((outcome) => outcome.ok && outcome.object).map((outcome) => [outcome.metaId, outcome.object as AdRow]));
  return objects.map((object) => {
    const row = rows.get(object.row.metaId);
    return row ? { ...object, row } : object;
  });
}

function distinctCount(ids: (string | undefined)[]): number | null {
  if (ids.some((id) => !id)) return null;
  return new Set(ids).size;
}

export function multiCrumbs(rows: AdRow[]): MultiCrumb[] {
  const level = rows[0]?.level;
  if (!level) return [];
  const crumbs: MultiCrumb[] = [];
  const campaigns = distinctCount(rows.map((row) => row.campaignId));
  const adSets = distinctCount(rows.map((row) => row.adSetId));
  if (level !== "campaign" && campaigns !== null) crumbs.push({ level: "campaign", count: campaigns });
  if (level === "ad" && adSets !== null) crumbs.push({ level: "adset", count: adSets });
  crumbs.push({ level, count: rows.length });
  return crumbs;
}

export function statusState(rows: AdRow[]): FieldState<boolean> {
  return fieldState(rows.map((row) => ({ metaId: row.metaId, name: row.name, value: row.isOn })));
}

export function multiAnalysis(objects: AdEditableObject[], timezone: string): MultiFact[] {
  const analyses = objects.map((object) => ({ row: object.row, facts: objectAnalysis(object, timezone) }));
  const keys = Array.from(new Set(analyses.flatMap(({ facts }) => facts.map((fact) => fact.key))));
  return keys.map((key) => ({
    key,
    state: fieldState(
      analyses.map(({ row, facts }) => ({
        metaId: row.metaId,
        name: row.name,
        value: facts.find((fact) => fact.key === key)?.value ?? { kind: "empty" },
      })),
    ),
  }));
}
