import { isPlainObject } from "./json-value";

export const VARIABLE_GROUPS = ["trigger", "nodes", "contact", "system", "secrets"] as const;
export type VariableGroup = (typeof VARIABLE_GROUPS)[number];

export const VARIABLE_KINDS = ["default", "trigger", "node", "system", "secret"] as const;
export type VariableKind = (typeof VARIABLE_KINDS)[number];

export const VARIABLE_TYPES = ["text", "number", "boolean", "object", "list", "date", "unknown"] as const;
export type VariableType = (typeof VARIABLE_TYPES)[number];

export const VARIABLE_AVAILABILITIES = ["always", "some_paths"] as const;
export type VariableAvailability = (typeof VARIABLE_AVAILABILITIES)[number];

export const TEMPLATE_REF_SOURCE = String.raw`\{\{\s*([\w.[\]]+)\s*\}\}`;

export interface VariableSource {
  nodeId: string;
  nodeName: string;
}

export interface CatalogVariable {
  ref: string;
  label: string;
  group: VariableGroup;
  kind: VariableKind;
  source: VariableSource | null;
  type: VariableType;
  example: string | null;
  availability: VariableAvailability;
}

export interface VariableCatalog {
  variables: CatalogVariable[];
  unreadable: number;
}

export interface VariableGroupView {
  group: VariableGroup;
  variables: CatalogVariable[];
}

export type VariableBadge = { kind: "default" } | { kind: "some_paths" } | { kind: "source"; nodeName: string };

export interface TemplateSegment {
  text: string;
  ref?: string;
}

export interface RefLabel {
  ref: string;
  label: string;
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return isText(value) && (values as readonly string[]).includes(value);
}

function readSource(value: unknown): VariableSource | null | undefined {
  if (value === null || value === undefined) return null;
  if (!isPlainObject(value) || !isText(value.nodeId) || !value.nodeId || !isText(value.nodeName)) return undefined;
  return { nodeId: value.nodeId, nodeName: value.nodeName };
}

function readVariable(value: unknown): CatalogVariable | null {
  if (!isPlainObject(value)) return null;
  const { ref, label, group, kind, type, availability } = value;
  const example = value.example ?? null;
  const source = readSource(value.source);
  if (!isText(ref) || !ref || !isText(label) || source === undefined) return null;
  if (example !== null && !isText(example)) return null;
  if (!oneOf(VARIABLE_GROUPS, group) || !oneOf(VARIABLE_KINDS, kind) || !oneOf(VARIABLE_TYPES, type) || !oneOf(VARIABLE_AVAILABILITIES, availability)) {
    return null;
  }
  return { ref, label, group, kind, source, type, example, availability };
}

export function readVariableCatalog(value: unknown): VariableCatalog | null {
  if (!isPlainObject(value) || !("variables" in value)) return null;
  const raw = value.variables ?? [];
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const variables: CatalogVariable[] = [];
  for (const entry of raw) {
    const read = readVariable(entry);
    if (!read || seen.has(read.ref)) continue;
    seen.add(read.ref);
    variables.push(read);
  }
  return { variables, unreadable: raw.length - variables.length };
}

export function variableGroupsOf(variables: readonly CatalogVariable[]): VariableGroupView[] {
  const groups = new Map<VariableGroup, CatalogVariable[]>();
  for (const item of variables) {
    const list = groups.get(item.group);
    if (list) list.push(item);
    else groups.set(item.group, [item]);
  }
  return Array.from(groups, ([group, list]) => ({ group, variables: list }));
}

export function searchVariables(variables: readonly CatalogVariable[], query: string): readonly CatalogVariable[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return variables;
  return variables.filter((item) => item.label.toLowerCase().includes(needle) || item.ref.toLowerCase().includes(needle));
}

export function variableBadges(item: CatalogVariable): VariableBadge[] {
  const badges: VariableBadge[] = [];
  if (item.kind === "default" || item.kind === "system") badges.push({ kind: "default" });
  if (item.availability === "some_paths") badges.push({ kind: "some_paths" });
  if (item.source) badges.push({ kind: "source", nodeName: item.source.nodeName });
  return badges;
}

export function variableTemplate(ref: string): string {
  return `{{${ref}}}`;
}

export function templateSegments(text: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(new RegExp(TEMPLATE_REF_SOURCE, "g"))) {
    const at = match.index ?? 0;
    if (at > cursor) segments.push({ text: text.slice(cursor, at) });
    segments.push({ text: match[0], ref: match[1] });
    cursor = at + match[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

export function knownRefLabels(text: string, variables: readonly CatalogVariable[]): RefLabel[] {
  const byRef = new Map(variables.map((item) => [item.ref, item.label]));
  const found = new Map<string, string>();
  for (const segment of templateSegments(text)) {
    const label = segment.ref ? byRef.get(segment.ref) : undefined;
    if (segment.ref && label !== undefined && !found.has(segment.ref)) found.set(segment.ref, label);
  }
  return Array.from(found, ([ref, label]) => ({ ref, label }));
}
