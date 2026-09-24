/**
 * Select items cannot carry an empty value, so an optional select would have
 * no way back to "nothing chosen" once something was picked. Optional selects
 * with a placeholder offer it as a real first choice under this sentinel,
 * which saves as "".
 */
export const EMPTY_CHOICE = "__empty__";

export function emptyChoiceLabel(field: { required?: boolean; placeholder?: string }): string | null {
  if (field.required) return null;
  const label = field.placeholder?.trim();
  return label ? label : null;
}

export function fromSelectValue(value: string): string {
  return value === EMPTY_CHOICE ? "" : value;
}
