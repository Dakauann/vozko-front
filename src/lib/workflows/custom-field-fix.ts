import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";

import { normalizeKeyValueMap } from "./key-value";
import type { LintIssue } from "./types";

export const UNKNOWN_CUSTOM_FIELD = "NODE_UNKNOWN_CUSTOM_FIELD";
const CUSTOM_FIELDS = "custom_fields";

export interface CreateCustomFieldRequest {
  nodeId: string;
  key: string;
}

export function unknownCustomFieldOf(issue: LintIssue, config: Record<string, unknown> | undefined): CreateCustomFieldRequest | null {
  if (issue.code !== UNKNOWN_CUSTOM_FIELD || !issue.nodeId || !issue.path || !config) return null;
  if (!(issue.path in normalizeKeyValueMap(config[CUSTOM_FIELDS]))) return null;
  return { nodeId: issue.nodeId, key: issue.path };
}

export function renameCustomField(config: Record<string, unknown>, from: string, to: string): Record<string, unknown> {
  const renamed: Record<string, string> = {};
  for (const [key, value] of Object.entries(normalizeKeyValueMap(config[CUSTOM_FIELDS]))) {
    renamed[key === from ? to : key] = value;
  }
  return { ...config, [CUSTOM_FIELDS]: renamed };
}

export function leadFieldsRevision(definitions: readonly CustomFieldDefinition[]): string {
  return definitions.map((field) => `${field.key}:${field.sensitive ? 1 : 0}`).sort().join(",");
}
