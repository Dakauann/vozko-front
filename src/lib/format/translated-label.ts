import type { CodedTranslator } from "@/lib/api/coded-error";

export function translatedLabel(t: CodedTranslator, key: string, fallbackKey: string): string {
  return t.has(key) ? t(key) : t(fallbackKey);
}
