import { relativeFromText } from "./sheet";

const MIN_NAME_LENGTH = 3;

export type LeadLookup = { kind: "number"; number: string } | { kind: "name"; name: string };

export function leadLookupFor(text: string): LeadLookup | null {
  const typed = relativeFromText(text);
  if (typed.number) return { kind: "number", number: typed.number.replace(/\D/g, "") };
  return typed.name.length >= MIN_NAME_LENGTH ? { kind: "name", name: typed.name } : null;
}
