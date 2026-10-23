import { isPlainObject } from "./json-value";

export const TRIGGER_INPUT_SHAPES = ["fields", "json", "message", "none"] as const;
export type TriggerInputShape = (typeof TRIGGER_INPUT_SHAPES)[number];

export const TRIGGER_INPUT_FIELD_TYPES = ["text", "number", "boolean", "object", "list", "date"] as const;
export type TriggerInputFieldType = (typeof TRIGGER_INPUT_FIELD_TYPES)[number];

export const TRIGGER_INPUT_ISSUE_CODES = [
  "event_not_accepted",
  "read_not_declared",
  "required",
  "too_large",
  "unknown_field",
  "unknown_option",
  "wrong_type",
] as const;

export const READ_NOT_DECLARED = "read_not_declared";

export const TRIGGER_WINDOWS = ["open", "closed"] as const;
export type TriggerWindow = (typeof TRIGGER_WINDOWS)[number];

const BIRTHDAY_FIELD_KEY = "birthday";

export interface TriggerInputOption {
  value: string;
  label: string;
}

export interface TriggerInputField {
  key: string;
  type: TriggerInputFieldType;
  required: boolean;
  description: string;
  example: unknown;
  options?: TriggerInputOption[];
  readBy: string[];
}

export interface TriggerInputIssue {
  code: string;
  key: string;
}

export interface TriggerInputSpec {
  nodeId: string;
  triggerType: string;
  label: string;
  shape: TriggerInputShape;
  fields: TriggerInputField[];
  sample: Record<string, unknown> | null;
  readKeys: string[];
  issues: TriggerInputIssue[];
  window: TriggerWindow | null;
  windowEditable: boolean;
  acceptedEvents: string[];
}

export interface SimTriggerStart {
  triggerNodeId: string;
  input?: unknown;
  windowOpen?: boolean;
}

export interface TriggerLastInput {
  input: unknown;
  maskedKeys: string[];
  runId: string;
  startedAt: string;
}

export type TriggerFieldControl = "text" | "number" | "switch" | "json" | "select" | "date";

export type TriggerFieldValue = string | boolean;

export interface TriggerInputDraft {
  values: Record<string, TriggerFieldValue>;
  extra: Record<string, unknown>;
  json: string;
  masked: string[];
}

export type TriggerStartBuild = { ok: true; start: SimTriggerStart } | { ok: false; syntax: string[] };

export interface TriggerIssueView {
  byField: Record<string, string[]>;
  general: TriggerInputIssue[];
}

const SHAPES: ReadonlySet<string> = new Set(TRIGGER_INPUT_SHAPES);
const FIELD_TYPES: ReadonlySet<string> = new Set(TRIGGER_INPUT_FIELD_TYPES);
const WINDOWS: ReadonlySet<string> = new Set(TRIGGER_WINDOWS);
const BODY_KEY = "";

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function textList(value: unknown): string[] | null {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isText)) return null;
  return value;
}

function readOptions(value: unknown): TriggerInputOption[] | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return null;
  const options = value.map((option) =>
    isPlainObject(option) && isText(option.value) && isText(option.label) ? { value: option.value, label: option.label } : null,
  );
  return options.every((option) => option !== null) ? (options as TriggerInputOption[]) : null;
}

function readField(value: unknown): TriggerInputField | null {
  if (!isPlainObject(value)) return null;
  const { key, type, required, description } = value;
  if (!isText(key) || !key || !isText(type) || !FIELD_TYPES.has(type) || typeof required !== "boolean") return null;
  if (description !== undefined && !isText(description)) return null;
  const readBy = textList(value.readBy);
  const options = readOptions(value.options);
  if (!readBy || options === null) return null;
  return {
    key,
    type: type as TriggerInputFieldType,
    required,
    description: description ?? "",
    example: value.example,
    ...(options ? { options } : {}),
    readBy,
  };
}

export function readTriggerInputIssues(value: unknown): TriggerInputIssue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((issue): TriggerInputIssue[] =>
    isPlainObject(issue) && isText(issue.code) && issue.code ? [{ code: issue.code, key: isText(issue.key) ? issue.key : "" }] : [],
  );
}

export function readTriggerInputSpec(value: unknown): TriggerInputSpec | null {
  if (!isPlainObject(value)) return null;
  const { nodeId, triggerType, label, shape, sample } = value;
  if (!isText(nodeId) || !nodeId || !isText(triggerType) || !isText(label) || !isText(shape) || !SHAPES.has(shape)) return null;
  if (sample !== null && sample !== undefined && !isPlainObject(sample)) return null;
  const window = value.window ?? null;
  if (window !== null && !(isText(window) && WINDOWS.has(window))) return null;
  if (typeof value.windowEditable !== "boolean") return null;
  const acceptedEvents = textList(value.acceptedEvents);
  if (!acceptedEvents) return null;
  const rawFields = value.fields ?? [];
  if (!Array.isArray(rawFields)) return null;
  const fields = rawFields.map(readField);
  const readKeys = textList(value.readKeys);
  if (!readKeys || fields.some((field) => field === null)) return null;
  return {
    nodeId,
    triggerType,
    label,
    shape: shape as TriggerInputShape,
    fields: fields as TriggerInputField[],
    sample: sample ?? null,
    readKeys,
    issues: readTriggerInputIssues(value.issues),
    window: window as TriggerWindow | null,
    windowEditable: value.windowEditable,
    acceptedEvents,
  };
}

export function readTriggerInputSpecs(value: unknown): { specs: TriggerInputSpec[]; unreadable: number } {
  if (!Array.isArray(value)) return { specs: [], unreadable: 0 };
  const read = value.map(readTriggerInputSpec);
  const specs = read.filter((spec): spec is TriggerInputSpec => spec !== null);
  return { specs, unreadable: read.length - specs.length };
}

export function readTriggerLastInput(value: unknown): TriggerLastInput | null {
  if (!isPlainObject(value) || !("input" in value)) return null;
  const maskedKeys = textList(value.maskedKeys);
  if (!maskedKeys || !isText(value.runId) || !value.runId || !isText(value.startedAt)) return null;
  return { input: value.input, maskedKeys, runId: value.runId, startedAt: value.startedAt };
}

export function orderedTriggerSpecs(specs: readonly TriggerInputSpec[], defaultNodeId: string | null): TriggerInputSpec[] {
  const primary = specs.find((spec) => spec.nodeId === defaultNodeId);
  return primary ? [primary, ...specs.filter((spec) => spec !== primary)] : [...specs];
}

export function chosenTriggerSpec(
  specs: readonly TriggerInputSpec[],
  chosenNodeId: string | null,
  defaultNodeId: string | null,
): TriggerInputSpec | null {
  return (
    specs.find((spec) => spec.nodeId === chosenNodeId) ??
    specs.find((spec) => spec.nodeId === defaultNodeId) ??
    specs[0] ??
    null
  );
}

export function triggerFieldControl(field: TriggerInputField): TriggerFieldControl {
  if (field.options && field.options.length > 0) return "select";
  if (field.key === BIRTHDAY_FIELD_KEY) return "date";
  switch (field.type) {
    case "number":
      return "number";
    case "boolean":
      return "switch";
    case "object":
    case "list":
      return "json";
    case "date":
      return "date";
    case "text":
      return "text";
  }
}

export function triggerDisplayLabel(spec: TriggerInputSpec, fallback: string | undefined): string {
  return spec.label || fallback || spec.triggerType;
}

export function defaultWindowOpen(spec: TriggerInputSpec): boolean | null {
  if (!spec.windowEditable || spec.window === null) return null;
  return spec.window === "open";
}

export function declaredReadIssues(spec: TriggerInputSpec): string[] {
  return spec.issues.filter((issue) => issue.code === READ_NOT_DECLARED).map((issue) => issue.key);
}

export function hasTriggerInput(spec: TriggerInputSpec): boolean {
  return spec.shape === "fields" || spec.shape === "json";
}

export function exampleText(example: unknown): string {
  if (example === undefined || example === null) return "";
  return isText(example) ? example : JSON.stringify(example);
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function emptyTriggerDraft(spec: TriggerInputSpec): TriggerInputDraft {
  return { values: {}, extra: {}, json: spec.shape === "json" ? prettyJson(spec.sample ?? {}) : "", masked: [] };
}

function fieldDraftValue(field: TriggerInputField, value: unknown): TriggerFieldValue | undefined {
  switch (triggerFieldControl(field)) {
    case "switch":
      return typeof value === "boolean" ? value : undefined;
    case "number":
      return typeof value === "number" ? String(value) : isText(value) ? value : undefined;
    case "json":
      return prettyJson(value);
    case "text":
    case "select":
    case "date":
      return isText(value) ? value : undefined;
  }
}

function exampleDraftValue(field: TriggerInputField): TriggerFieldValue | undefined {
  const { example } = field;
  if (example === undefined || example === null || example === "") return undefined;
  if (triggerFieldControl(field) === "switch") return typeof example === "boolean" ? example : undefined;
  return exampleText(example);
}

function isBlank(value: TriggerFieldValue | undefined): boolean {
  return value === undefined || (typeof value === "string" && value.trim() === "");
}

function fillableExamples(spec: TriggerInputSpec, draft: TriggerInputDraft): Array<[string, TriggerFieldValue]> {
  if (spec.shape !== "fields") return [];
  return spec.fields.flatMap((field): Array<[string, TriggerFieldValue]> => {
    if (!isBlank(draft.values[field.key])) return [];
    const example = exampleDraftValue(field);
    return example === undefined ? [] : [[field.key, example]];
  });
}

export function hasExamplesToFill(spec: TriggerInputSpec, draft: TriggerInputDraft): boolean {
  return fillableExamples(spec, draft).length > 0;
}

export function withExamples(spec: TriggerInputSpec, draft: TriggerInputDraft): TriggerInputDraft {
  return fillableExamples(spec, draft).reduce((next, [key, value]) => withFieldValue(next, key, value), draft);
}

export function draftFromInput(spec: TriggerInputSpec, input: unknown, masked: readonly string[] = []): TriggerInputDraft {
  if (spec.shape !== "fields") return { ...emptyTriggerDraft(spec), json: prettyJson(input ?? {}), masked: [...masked] };
  const source = isPlainObject(input) ? input : {};
  const hidden = new Set(masked);
  const fieldsByKey = new Map(spec.fields.map((field) => [field.key, field]));
  const values: Record<string, TriggerFieldValue> = {};
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    const field = fieldsByKey.get(key);
    if (hidden.has(key)) {
      if (field && field.type !== "boolean") values[key] = "";
      continue;
    }
    const draftValue = field ? fieldDraftValue(field, value) : undefined;
    if (draftValue === undefined) extra[key] = value;
    else values[key] = draftValue;
  }
  return { values, extra, json: "", masked: [...masked] };
}

export function withFieldValue(draft: TriggerInputDraft, key: string, value: TriggerFieldValue): TriggerInputDraft {
  const extra = { ...draft.extra };
  delete extra[key];
  return { ...draft, values: { ...draft.values, [key]: value }, extra, masked: draft.masked.filter((masked) => masked !== key) };
}

export function withJsonText(draft: TriggerInputDraft, json: string): TriggerInputDraft {
  return { ...draft, json };
}

type ParsedJson = { ok: true; value: unknown } | { ok: false };

function parseJson(text: string): ParsedJson {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function numberValue(text: string): number | string {
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : text;
}

function startWith(spec: TriggerInputSpec, windowOpen: boolean | undefined, input?: { value: unknown }): TriggerStartBuild {
  const window = defaultWindowOpen(spec);
  return {
    ok: true,
    start: {
      triggerNodeId: spec.nodeId,
      ...(input ? { input: input.value } : {}),
      ...(window === null ? {} : { windowOpen: windowOpen ?? window }),
    },
  };
}

export function triggerStartOf(spec: TriggerInputSpec, draft: TriggerInputDraft, windowOpen?: boolean): TriggerStartBuild {
  if (spec.shape === "none" || spec.shape === "message") return startWith(spec, windowOpen);
  if (spec.shape === "json") {
    const parsed = parseJson(draft.json);
    return parsed.ok ? startWith(spec, windowOpen, { value: parsed.value }) : { ok: false, syntax: [BODY_KEY] };
  }
  const input: Record<string, unknown> = { ...draft.extra };
  const syntax: string[] = [];
  for (const field of spec.fields) {
    const value = draft.values[field.key];
    if (value === undefined) continue;
    if (typeof value === "boolean") {
      input[field.key] = value;
      continue;
    }
    const text = value.trim();
    if (!text) continue;
    const control = triggerFieldControl(field);
    if (control === "number") input[field.key] = numberValue(text);
    else if (control === "json") {
      const parsed = parseJson(text);
      if (parsed.ok) input[field.key] = parsed.value;
      else syntax.push(field.key);
    } else input[field.key] = value;
  }
  return syntax.length > 0 ? { ok: false, syntax } : startWith(spec, windowOpen, { value: input });
}

export function triggerIssueView(spec: TriggerInputSpec, issues: readonly TriggerInputIssue[]): TriggerIssueView {
  const keys = new Set(spec.shape === "fields" ? spec.fields.map((field) => field.key) : []);
  const byField: Record<string, string[]> = {};
  const general: TriggerInputIssue[] = [];
  for (const issue of issues) {
    if (issue.code === READ_NOT_DECLARED) continue;
    if (keys.has(issue.key)) byField[issue.key] = [...(byField[issue.key] ?? []), issue.code];
    else general.push(issue);
  }
  return { byField, general };
}
