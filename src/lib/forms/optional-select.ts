export const EMPTY_CHOICE = "__empty__";

export function emptyChoiceLabel(field: { required?: boolean; placeholder?: string }): string | null {
  if (field.required) return null;
  const label = field.placeholder?.trim();
  return label ? label : null;
}

export function fromSelectValue(value: string): string {
  return value === EMPTY_CHOICE ? "" : value;
}
