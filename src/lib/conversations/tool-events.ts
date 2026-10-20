import { boundKeyOf } from "@/lib/agents/tool-bindings";
import type { AgentToolDefinition } from "@/lib/agents/types";

import { messageTypeOf } from "./direction";
import type { ConversationMessage } from "./types";

export type ToolEventKind = "call" | "result";

export interface ToolEventInfo {
  kind: ToolEventKind;
  toolName?: string;
  title: string;
  subtitle: string;
  detail: string;
  raw: string;
}

export type ToolDefinitionByName = Map<string, AgentToolDefinition>;

export interface ToolCopy {
  fallbackName: string;
  resultTitle: string;
  callSubtitle: string;
  resultSubtitle: string;
  callRunning: string;
  resultDone: string;
  imageSentTo: (recipient: string) => string;
}

export function toolEventKind(messageType: string | undefined, text?: string): ToolEventKind | null {
  const trimmedText = text?.trim() ?? "";
  if (messageType === "tool_call" || trimmedText.startsWith("[Tool Call]")) {
    return "call";
  }
  if (messageType === "tool_result" || trimmedText.startsWith("[Tool Result]")) {
    return "result";
  }
  return null;
}

export function isToolMessage(msg: ConversationMessage | null | undefined): boolean {
  if (!msg) return false;
  return toolEventKind(messageTypeOf(msg), msg.text) !== null;
}

function stripToolPrefix(text: string): string {
  return text.replace(/^\[Tool (?:Call|Result)\]\s*/i, "").trim();
}

function humanizeIdentifier(value: string | undefined, fallback: string): string {
  const normalized = value?.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.replace(/^./, (char) => char.toUpperCase());
}

function definitionFor(toolName: string, toolDefinitions: ToolDefinitionByName): AgentToolDefinition | undefined {
  const exact = toolDefinitions.get(toolName);
  if (exact) return exact;
  for (const definition of toolDefinitions.values()) {
    if (definition.bindingKey && boundKeyOf(toolName, definition.name) !== null) return definition;
  }
  return undefined;
}

export function toolDisplayName(toolName: string | undefined, toolDefinitions: ToolDefinitionByName, fallbackName: string): string {
  if (!toolName) return fallbackName;
  return definitionFor(toolName, toolDefinitions)?.displayName?.trim() || humanizeIdentifier(toolName, fallbackName);
}

function truncateText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function cleanToolValue(value: string): string {
  return value
    .replace(/\\"/g, '"')
    .replace(/^map\[/, "")
    .replace(/\]$/, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
}

function formatToolValue(value: string): string {
  const cleaned = cleanToolValue(value);
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) return truncateText(cleaned, 64);
  if (/^[a-f0-9-]{16,}$/i.test(cleaned)) return truncateText(cleaned, 18);
  return truncateText(cleaned, 72);
}

function parseToolMessageBody(kind: ToolEventKind, text: string) {
  const body = stripToolPrefix(text);

  if (kind === "call") {
    const match = body.match(/^([a-zA-Z0-9_.-]+)(?::|\s|$)\s*([\s\S]*)$/);
    return {
      toolName: match?.[1],
      payload: match?.[2]?.trim() ?? "",
      body,
    };
  }

  const resultWithToolName = body.match(/^([a-zA-Z0-9_.-]+)\s*:\s*([\s\S]*)$/);
  return {
    toolName: resultWithToolName?.[1],
    payload: resultWithToolName?.[2]?.trim() ?? body,
    body,
  };
}

export function toolCallNameOf(msg: ConversationMessage): string | null {
  if (toolEventKind(messageTypeOf(msg), msg.text) !== "call") return null;
  return parseToolMessageBody("call", msg.text ?? "").toolName ?? null;
}

export function toolCallIdOf(msg: ConversationMessage): string | undefined {
  const id = (msg.metadata as { tool_call_id?: unknown } | undefined)?.tool_call_id;
  return typeof id === "string" && id !== "" ? id : undefined;
}

function parseJsonArguments(payload: string): Record<string, string> | null {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value === null || value === undefined) return acc;
      acc[key] = typeof value === "string" ? value : JSON.stringify(value, null, 0);
      return acc;
    }, {});
  } catch {
    return null;
  }
}

function parseToolArguments(payload: string): Record<string, string> {
  const trimmedPayload = payload.trim();
  if (!trimmedPayload) return {};

  if (trimmedPayload.startsWith("{") && trimmedPayload.endsWith("}")) {
    const parsed = parseJsonArguments(trimmedPayload);
    if (parsed) return parsed;
  }

  const mapBody = cleanToolValue(trimmedPayload).replace(/^map\[/, "");
  const entries = [...mapBody.matchAll(/(?:^|\s)([a-zA-Z0-9_.-]+):([\s\S]*?)(?=\s+[a-zA-Z0-9_.-]+:|$)/g)];

  return entries.reduce<Record<string, string>>((acc, match) => {
    const key = match[1]?.trim();
    const value = cleanToolValue(match[2] ?? "");
    if (!key || !value) return acc;
    acc[key] = value;
    return acc;
  }, {});
}

function isTechnicalArgumentKey(key: string): boolean {
  return (
    key.startsWith("__") ||
    key === "id" ||
    key.endsWith("_id") ||
    key.endsWith("Id") ||
    key.includes("token") ||
    key.includes("secret")
  );
}

function parameterDisplayName(definition: AgentToolDefinition | undefined, key: string, copy: ToolCopy): string {
  return definition?.parameters?.[key]?.displayName?.trim() || humanizeIdentifier(key, copy.fallbackName);
}

function summarizeToolCall(definition: AgentToolDefinition | undefined, payload: string, copy: ToolCopy) {
  const parsedArguments = parseToolArguments(payload);
  const argumentEntries = Object.entries(parsedArguments);

  if (argumentEntries.length) {
    const orderedKeys = [
      ...Object.keys(definition?.parameters ?? {}).filter((key) => parsedArguments[key]),
      ...Object.keys(parsedArguments).filter((key) => !(key in (definition?.parameters ?? {}))),
    ];

    const visibleKeys = orderedKeys.filter((key) => !isTechnicalArgumentKey(key));
    const keysToRender = (visibleKeys.length ? visibleKeys : orderedKeys).slice(0, 2);
    if (keysToRender.length) {
      return keysToRender
        .map((key) => `${parameterDisplayName(definition, key, copy)}: ${formatToolValue(parsedArguments[key])}`)
        .join(" · ");
    }
  }

  const cleanedPayload = truncateText(cleanToolValue(payload), 120);
  return cleanedPayload || copy.callRunning;
}

function readableResultField(cleaned: string): string | null {
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const resultObject = parsed as Record<string, unknown>;
    return (
      [resultObject.message, resultObject.status, resultObject.result, resultObject.error].find(
        (value): value is string => typeof value === "string",
      ) ?? null
    );
  } catch {
    return null;
  }
}

function summarizeToolResult(payload: string, copy: ToolCopy): string {
  const cleaned = cleanToolValue(payload);
  if (!cleaned) return copy.resultDone;

  const imageSentMatch = cleaned.match(/image sent successfully to\s+(\d+)/i);
  if (imageSentMatch?.[1]) {
    return copy.imageSentTo(imageSentMatch[1]);
  }

  const readableField = readableResultField(cleaned);
  if (readableField) return truncateText(cleanToolValue(readableField), 120);

  return truncateText(cleaned, 120);
}

export function toolEventInfo(
  msg: ConversationMessage,
  toolDefinitions: ToolDefinitionByName,
  copy: ToolCopy,
  relatedToolName?: string,
): ToolEventInfo | null {
  const kind = toolEventKind(messageTypeOf(msg), msg.text);
  if (!kind) return null;

  const raw = msg.text ?? "";
  const parsed = parseToolMessageBody(kind, raw);
  const toolName = parsed.toolName ?? relatedToolName;
  const definition = toolName ? toolDefinitions.get(toolName) : undefined;
  const displayName = toolDisplayName(toolName, toolDefinitions, copy.fallbackName);
  const detail = kind === "call" ? summarizeToolCall(definition, parsed.payload, copy) : summarizeToolResult(parsed.payload, copy);

  return {
    kind,
    toolName,
    title: kind === "call" ? displayName : copy.resultTitle,
    subtitle: kind === "call" ? copy.callSubtitle : copy.resultSubtitle,
    detail,
    raw,
  };
}
