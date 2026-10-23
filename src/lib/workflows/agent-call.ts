import { isIdentifierName, toIdentifierName } from "./identifier-name";
import type { WorkflowGraph } from "./types";

export const AGENT_CALL_TRIGGER = "trigger_agent_call";
export const REPLY_TO_AGENT_NODE = "action_reply_to_agent";
export const AGENT_CALL_INPUTS_KEY = "inputs";
export const REPLY_TO_AGENT_FIELDS_KEY = "fields";

export const AGENT_CALL_INPUT_TYPES = ["string", "number", "boolean", "object", "array"] as const;

export type AgentCallInputType = (typeof AGENT_CALL_INPUT_TYPES)[number];

export interface AgentCallInput {
  name: string;
  type: AgentCallInputType;
  description: string;
  required: boolean;
  example: string;
}

export type AgentCallInputIssueCode = "name_missing" | "name_pattern" | "name_duplicate" | "type_unknown";

export interface AgentCallInputIssue {
  index: number;
  code: AgentCallInputIssueCode;
}

export interface ReplyField {
  key: string;
  value: string;
}

type Loose = Record<string, unknown>;

function isRecord(value: unknown): value is Loose {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function isAgentCallInputType(type: string): type is AgentCallInputType {
  return (AGENT_CALL_INPUT_TYPES as readonly string[]).includes(type);
}

export function emptyAgentCallInput(): AgentCallInput {
  return { name: "", type: "string", description: "", required: false, example: "" };
}

function inputFrom(item: Loose): AgentCallInput {
  const type = text(item.type).trim();
  return {
    name: text(item.name),
    type: (type || "string") as AgentCallInputType,
    description: text(item.description),
    required: item.required === true,
    example: text(item.example),
  };
}

export function readAgentCallInputs(raw: unknown): AgentCallInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map(inputFrom);
}

export function agentCallInputIssues(inputs: readonly AgentCallInput[]): AgentCallInputIssue[] {
  const issues: AgentCallInputIssue[] = [];
  const seen = new Set<string>();
  inputs.forEach((input, index) => {
    const name = input.name.trim();
    if (name === "") issues.push({ index, code: "name_missing" });
    else if (!isIdentifierName(name)) issues.push({ index, code: "name_pattern" });
    else if (!isAgentCallInputType(input.type)) issues.push({ index, code: "type_unknown" });
    else if (seen.has(name)) issues.push({ index, code: "name_duplicate" });
    seen.add(name);
  });
  return issues;
}

export interface BodySchemaImport {
  inputs: AgentCallInput[];
  added: number;
  skipped: string[];
}

export function importBodySchema(existing: readonly AgentCallInput[], bodySchema: unknown): BodySchemaImport {
  const inputs = [...existing];
  const taken = new Set(existing.map((input) => input.name.trim()));
  const skipped: string[] = [];
  let added = 0;
  for (const field of Array.isArray(bodySchema) ? bodySchema.filter(isRecord) : []) {
    const original = text(field.name);
    const name = toIdentifierName(original);
    if (!name || taken.has(name)) {
      skipped.push(original);
      continue;
    }
    const type = text(field.type).trim();
    inputs.push({
      name,
      type: isAgentCallInputType(type) ? type : "string",
      description: text(field.description),
      required: field.required === true,
      example: text(field.example),
    });
    taken.add(name);
    added += 1;
  }
  return { inputs, added, skipped };
}

export function agentCallInputsOfGraph(graph: WorkflowGraph | null | undefined): AgentCallInput[] | null {
  const trigger = graph?.nodes?.find((node) => node.type === AGENT_CALL_TRIGGER);
  if (!trigger) return null;
  return readAgentCallInputs(trigger.config?.[AGENT_CALL_INPUTS_KEY]);
}

export function readReplyFields(raw: unknown): ReplyField[] {
  if (Array.isArray(raw)) {
    return raw.filter(isRecord).map((pair) => ({ key: text(pair.key), value: text(pair.value) }));
  }
  if (isRecord(raw)) {
    return Object.keys(raw)
      .filter((key) => key.trim() !== "")
      .sort()
      .map((key) => ({ key: key.trim(), value: text(raw[key]) }));
  }
  return [];
}

const HTTP_REQUEST_TOOL = "http_request";

export interface HttpBodySchemaSource {
  key: string;
  method: string;
  url: string;
  fields: number;
  bodySchema: unknown[];
}

interface ToolBindingLike {
  name: string;
  config?: Record<string, unknown>;
}

export function httpBodySchemaSources(bindings: readonly ToolBindingLike[] | undefined): HttpBodySchemaSource[] {
  const sources: HttpBodySchemaSource[] = [];
  (bindings ?? []).forEach((binding, index) => {
    const bodySchema = binding.config?.body_schema;
    if (binding.name !== HTTP_REQUEST_TOOL || !Array.isArray(bodySchema) || bodySchema.length === 0) return;
    sources.push({
      key: String(index),
      method: text(binding.config?.method) || "POST",
      url: text(binding.config?.url),
      fields: bodySchema.length,
      bodySchema,
    });
  });
  return sources;
}
