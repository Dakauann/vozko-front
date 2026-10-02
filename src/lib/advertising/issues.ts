export type ExpectedIssues = Record<string, string>;

export interface FieldIssue {
  field: string;
  code: string;
}

export function issueFieldKey(field: string): string {
  return field.replace(/\[\d+\]/g, "").replace(/\./g, "_");
}

export function issuesAt(expected: ExpectedIssues | undefined, field: string): FieldIssue[] {
  if (!expected) return [];
  return Object.entries(expected)
    .filter(([key]) => key === field)
    .map(([key, code]) => ({ field: key, code }));
}

export function issuesUnder(expected: ExpectedIssues | undefined, prefix: string): FieldIssue[] {
  if (!expected) return [];
  return Object.entries(expected)
    .filter(([key]) => key === prefix || key.startsWith(`${prefix}.`) || key.startsWith(`${prefix}[`))
    .map(([key, code]) => ({ field: key, code }));
}

export function withoutIssue(expected: ExpectedIssues, field: string): ExpectedIssues {
  if (!(field in expected)) return expected;
  const next = { ...expected };
  delete next[field];
  return next;
}
