export interface InteractiveButton {
  Type: string;
  ID: string;
  Title: string;
  CopyCode: string;
}

export interface InteractiveListRow {
  id: string;
  title: string;
  description: string;
}

const BUTTON_KEYS = ["CopyCode", "ID", "Title", "Type"];
const SECTION_KEYS = ["rows", "title"];
const ROW_KEYS = ["description", "id", "title"];

function storedList(value: unknown): unknown[] | null {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasExactly(value: unknown, keys: string[], texts: string[]): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const present = Object.keys(record).sort();
  return present.length === keys.length && present.every((key, i) => key === keys[i]) && texts.every((key) => typeof record[key] === "string");
}

export function readCanonicalButtons(value: unknown): InteractiveButton[] | null {
  const list = storedList(value);
  if (!list || !list.every((item) => hasExactly(item, BUTTON_KEYS, BUTTON_KEYS))) return null;
  return list as unknown as InteractiveButton[];
}

export function readCanonicalListRows(value: unknown): InteractiveListRow[] | null {
  const list = storedList(value);
  if (!list) return null;
  const rows: InteractiveListRow[] = [];
  for (const section of list) {
    if (!hasExactly(section, SECTION_KEYS, ["title"]) || !Array.isArray(section.rows)) return null;
    for (const row of section.rows) {
      if (!hasExactly(row, ROW_KEYS, ROW_KEYS)) return null;
      rows.push(row as unknown as InteractiveListRow);
    }
  }
  return rows;
}

export function encodeInteractiveListRows(rows: InteractiveListRow[]): string {
  return JSON.stringify([{ title: "", rows }]);
}
