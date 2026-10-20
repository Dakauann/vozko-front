export type WhatsAppMarker = "*" | "_" | "~";

export interface TextSelection {
  text: string;
  start: number;
  end: number;
}

function selectsItsOwnMarkers(selected: string, marker: WhatsAppMarker): boolean {
  return selected.length >= 2 && selected.startsWith(marker) && selected.endsWith(marker);
}

export function toggleMarker({ text, start, end }: TextSelection, marker: WhatsAppMarker): TextSelection {
  const selected = text.slice(start, end);
  if (selectsItsOwnMarkers(selected, marker)) {
    const inner = selected.slice(1, -1);
    return { text: text.slice(0, start) + inner + text.slice(end), start, end: start + inner.length };
  }

  const from = start + (selected.length - selected.trimStart().length);
  const to = end - (selected.length - selected.trimEnd().length);
  if (from >= to) {
    return { text: text.slice(0, start) + marker + marker + text.slice(start), start: start + 1, end: start + 1 };
  }
  if (text[from - 1] === marker && text[to] === marker) {
    return { text: text.slice(0, from - 1) + text.slice(from, to) + text.slice(to + 1), start: from - 1, end: to - 1 };
  }
  return { text: text.slice(0, from) + marker + text.slice(from, to) + marker + text.slice(to), start: from + 1, end: to + 1 };
}

export function insertAtSelection({ text, start, end }: TextSelection, inserted: string): TextSelection {
  const from = Math.min(start, end, text.length);
  const to = Math.min(Math.max(start, end), text.length);
  const caret = from + inserted.length;
  return { text: text.slice(0, from) + inserted + text.slice(to), start: caret, end: caret };
}
