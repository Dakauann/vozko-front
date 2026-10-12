import type { ToolSubject } from "./types";

export function subjectLabelOf(subject: ToolSubject, translated: (key: string) => string | null): string {
  const whole = translated(`${subject.kind}.${subject.key}`);
  if (whole) return whole;
  const parts = subject.key.split(",");
  if (parts.length < 2) return subject.label;
  const labels = parts.map((part) => translated(`${subject.kind}.${part}`));
  return labels.every((label): label is string => !!label) ? labels.join(", ") : subject.label;
}
