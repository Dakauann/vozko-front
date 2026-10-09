import type { CodedTranslator } from "@/lib/api/coded-error";
import { translatedLabel } from "@/lib/format/translated-label";
import { customFieldKeyOf } from "@/lib/leads/sheet";

export interface LabelledField {
  key: string;
  label: string;
}

export function leadFieldLabel(t: CodedTranslator, field: string, definitions: readonly LabelledField[]): string {
  const key = customFieldKeyOf(field);
  if (key !== null) return definitions.find((definition) => definition.key === key)?.label ?? t("fields.customField");
  return translatedLabel(t, `fields.${field}`, "fields.other");
}
