export interface HighlightPart {
  text: string;
  match: boolean;
}

export const HIGHLIGHT_MIN_LENGTH = 2;

export function highlightParts(text: string, query: string): HighlightPart[] {
  if (!text) return [];
  const term = query.trim().toLowerCase();
  if (term.length < HIGHLIGHT_MIN_LENGTH) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (let index = lower.indexOf(term); index !== -1; index = lower.indexOf(term, cursor)) {
    if (index > cursor) parts.push({ text: text.slice(cursor, index), match: false });
    parts.push({ text: text.slice(index, index + term.length), match: true });
    cursor = index + term.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts;
}
