export function configText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
