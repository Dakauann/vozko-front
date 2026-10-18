export type Json = Record<string, unknown>;

export function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isText(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

export function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
