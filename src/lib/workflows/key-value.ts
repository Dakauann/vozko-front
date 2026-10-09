function textOf(value: unknown): string {
  return value == null ? "" : String(value);
}

function entriesOf(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, textOf(entry)]));
}

export function normalizeKeyValueMap(value: unknown): Record<string, string> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? entriesOf(parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof value === "object") return entriesOf(value as Record<string, unknown>);
  return {};
}
