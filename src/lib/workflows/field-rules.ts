import type { ConfigField, FieldRule } from "./types";

function matches(rule: FieldRule | undefined, config: Record<string, unknown>): boolean {
  return !!rule && rule.values.includes(String(config[rule.field] ?? ""));
}

export function fieldVisible(field: ConfigField, config: Record<string, unknown>): boolean {
  return !field.visibleWhen || matches(field.visibleWhen, config);
}

export function fieldRequired(field: ConfigField, config: Record<string, unknown>): boolean {
  return fieldVisible(field, config) && (field.required === true || matches(field.requiredWhen, config));
}
