import {
  customFieldKey,
  customFieldTypeHasOptions,
  optionTone,
  type CustomFieldDefinition,
  type CustomFieldInput,
  type CustomFieldObjectType,
  type CustomFieldTone,
  type CustomFieldType,
} from "@/lib/crm/custom-fields";

export interface OptionDraft {
  key: string;
  value: string;
  tone?: CustomFieldTone;
}

export interface FieldDraft {
  id?: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options: OptionDraft[];
  required: boolean;
  sensitive: boolean | null;
  legalBasis: string;
  legalBasisExample?: string;
  classification: boolean;
}

let optionSequence = 0;
export function optionKey(): string {
  optionSequence += 1;
  return `option-${optionSequence}`;
}

export function emptyFieldDraft(): FieldDraft {
  return { key: "", label: "", type: "text", options: [], required: false, sensitive: null, legalBasis: "", classification: false };
}

function optionDrafts(options: string[] | undefined, tones: (option: string) => CustomFieldTone | undefined): OptionDraft[] {
  return (options ?? []).map((value) => ({ key: optionKey(), value, tone: tones(value) }));
}

export function draftFromDefinition(field: CustomFieldDefinition): FieldDraft {
  return {
    id: field.id,
    key: field.key,
    label: field.label,
    type: field.type,
    options: optionDrafts(field.options, (option) => optionTone(field, option)),
    required: field.required,
    sensitive: field.sensitive,
    legalBasis: field.legalBasis ?? "",
    classification: field.role === "classification",
  };
}

export function draftFromInput(input: CustomFieldInput): FieldDraft {
  return {
    key: input.key,
    label: input.label,
    type: input.type,
    options: optionDrafts(input.options, (option) => input.optionTones?.[option]),
    required: input.required ?? false,
    sensitive: input.sensitive ?? null,
    legalBasis: input.legalBasis ?? "",
    classification: input.role === "classification",
  };
}

export function asksSensitivity(objectType: CustomFieldObjectType): boolean {
  return objectType === "lead";
}

export function draftIsComplete(objectType: CustomFieldObjectType, draft: FieldDraft): boolean {
  if (draft.label.trim() === "") return false;
  if (!asksSensitivity(objectType)) return true;
  if (draft.sensitive === null) return false;
  return !draft.sensitive || draft.legalBasis.trim() !== "";
}

export function draftPayload(objectType: CustomFieldObjectType, draft: FieldDraft): CustomFieldInput | null {
  const label = draft.label.trim();
  const key = draft.key.trim() || customFieldKey(label);
  if (!key) return null;
  const hasOptions = customFieldTypeHasOptions(draft.type);
  const options = hasOptions ? draft.options.map((option) => ({ ...option, value: option.value.trim() })).filter((option) => option.value) : [];
  const optionTones = Object.fromEntries(
    options.filter((option) => option.tone).map((option) => [option.value, option.tone as CustomFieldTone]),
  );
  const payload: CustomFieldInput = {
    objectType,
    key,
    label,
    type: draft.type,
    required: draft.required,
    optionTones,
    ...(hasOptions ? { options: options.map((option) => option.value) } : {}),
  };
  if (!asksSensitivity(objectType)) return payload;
  const sensitive = draft.sensitive === true;
  return {
    ...payload,
    sensitive,
    legalBasis: sensitive ? draft.legalBasis.trim() : "",
    role: draft.classification && draft.type === "select" ? "classification" : "",
  };
}
