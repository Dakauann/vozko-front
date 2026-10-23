import { secretUsageSnippets } from "@/lib/workflow-secrets/secret-name";

import { toIdentifierName } from "./identifier-name";
import { normalizeKeyValueMap } from "./key-value";
import type { LintIssue } from "./types";
import { TEMPLATE_REF_SOURCE } from "./variable-catalog";

export const SECRET_IN_PLAIN_TEXT = "NODE_SECRET_IN_PLAIN_TEXT";
export const CODE_READS_TEMPLATE = "NODE_CODE_READS_TEMPLATE";

type Config = Record<string, unknown>;

export interface PlainSecretFix {
  value: string;
  suggestedName: string;
  replace: (secretName: string) => Config;
}

const HEADER_PATH = "headers.";
const BODY_PATH = "body.";
const CODE_PATH = "code:";
const AUTH_TOKEN_PATH = "auth_token";
const VALUE_PATH = "config.value";
const CODE_ASSIGNMENT = /['"]?([A-Za-z_$][\w$]*)['"]?\s*[:=]\s*('[^'\n]+'|"[^"\n]+"|`[^`\n]+`)/g;
const TEMPLATE_IN_CODE = new RegExp(TEMPLATE_REF_SOURCE);
const CONCRETE_CODE_READ = /(?:state|secrets)\.get\('[^'<>]*'\)/g;

function isPlainCredential(value: unknown): boolean {
  if (value === undefined || value === null || typeof value === "boolean") return false;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed !== "" && !trimmed.includes("{{");
  }
  return true;
}

function literalText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function fixFor(name: string, value: unknown, replace: (secret: string) => Config): PlainSecretFix | null {
  if (!isPlainCredential(value)) return null;
  return { value: literalText(value), suggestedName: toIdentifierName(name), replace };
}

function templateOf(name: string): string {
  return secretUsageSnippets(name).template;
}

function headerFix(key: string, config: Config): PlainSecretFix | null {
  const headers = normalizeKeyValueMap(config.headers);
  if (!(key in headers)) return null;
  return fixFor(key, headers[key], (name) => ({ ...config, headers: { ...headers, [key]: templateOf(name) } }));
}

function fieldFix(config: Config, field: string, name: string): PlainSecretFix | null {
  return fixFor(name, config[field], (secret) => ({ ...config, [field]: templateOf(secret) }));
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function holderAt(root: JsonObject, parents: readonly string[]): JsonObject | null {
  let node: unknown = root;
  for (const key of parents) {
    if (!isObject(node)) return null;
    node = node[key];
  }
  return isObject(node) ? node : null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bodyFix(path: readonly string[], config: Config): PlainSecretFix | null {
  const body = typeof config.body === "string" ? config.body : null;
  const leaf = path[path.length - 1];
  if (body === null || !leaf) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isObject(parsed)) return null;
  const holder = holderAt(parsed, path.slice(0, -1));
  if (!holder || !(leaf in holder)) return null;
  const value = holder[leaf];
  const pair = new RegExp(`(${escapeRegExp(JSON.stringify(leaf))}\\s*:\\s*)${escapeRegExp(JSON.stringify(value))}`, "g");
  const inPlace = (body.match(pair) ?? []).length === 1;
  return fixFor(leaf, value, (name) => {
    const placeholder = templateOf(name);
    if (inPlace) return { ...config, body: body.replace(pair, (_, prefix: string) => `${prefix}${JSON.stringify(placeholder)}`) };
    holder[leaf] = placeholder;
    return { ...config, body: JSON.stringify(parsed, null, 2) };
  });
}

function codeFix(target: string, config: Config): PlainSecretFix | null {
  const code = typeof config.code === "string" ? config.code : null;
  if (code === null || target === "") return null;
  for (const match of code.matchAll(CODE_ASSIGNMENT)) {
    const [whole, name, literal] = match;
    if (name !== target) continue;
    if (literal.startsWith("`") && literal.includes("${")) continue;
    const start = (match.index ?? 0) + whole.length - literal.length;
    return fixFor(target, literal.slice(1, -1), (secret) => ({
      ...config,
      code: code.slice(0, start) + secretUsageSnippets(secret).code + code.slice(start + literal.length),
    }));
  }
  return null;
}

export function plainSecretFix(issue: LintIssue, config: Config): PlainSecretFix | null {
  if (issue.code !== SECRET_IN_PLAIN_TEXT || !issue.path) return null;
  const path = issue.path;
  if (path === AUTH_TOKEN_PATH) return fieldFix(config, "auth_token", "auth_token");
  if (path === VALUE_PATH) return fieldFix(config, "value", typeof config.variable === "string" ? config.variable : "value");
  if (path.startsWith(HEADER_PATH)) return headerFix(path.slice(HEADER_PATH.length), config);
  if (path.startsWith(BODY_PATH)) return bodyFix(path.slice(BODY_PATH.length).split("."), config);
  if (path.startsWith(CODE_PATH)) return codeFix(path.slice(CODE_PATH.length), config);
  return null;
}

export interface CodeTemplateSuggestion {
  template: string;
  replacement: string | null;
}

export function codeTemplateSuggestion(issue: LintIssue, config: Config | undefined): CodeTemplateSuggestion | null {
  if (issue.code !== CODE_READS_TEMPLATE || issue.path !== "code") return null;
  const code = typeof config?.code === "string" ? config.code : "";
  const template = TEMPLATE_IN_CODE.exec(code)?.[0];
  if (!template) return null;
  const reads = (issue.hint ?? "").match(CONCRETE_CODE_READ);
  return { template, replacement: reads ? reads[reads.length - 1] : null };
}
