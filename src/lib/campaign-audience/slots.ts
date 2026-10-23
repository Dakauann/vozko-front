import type { VariableCount } from "./types";

const SLOT = /\{\{\s*([^{}\s]+)\s*\}\}/g;

export type SlotSegment = { text: string } | { text: string; variable: VariableCount; position: number } | { text: string; name: string };

export function slotSegments(text: string, header: boolean, variables: readonly VariableCount[]): SlotSegment[] {
  const segments: SlotSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(SLOT)) {
    const at = match.index ?? 0;
    if (at > last) segments.push({ text: text.slice(last, at) });
    const position = variables.findIndex((candidate) => candidate.header === header && candidate.name === match[1]);
    segments.push(position < 0 ? { text: match[0], name: match[1] } : { text: match[0], variable: variables[position], position });
    last = at + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

export interface SlotPreview {
  value: string;
  source?: string;
  fallback?: string;
}
