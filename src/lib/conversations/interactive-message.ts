export type InteractiveChoiceKind = "button" | "list";

export interface InteractiveChoice {
  kind: InteractiveChoiceKind;
  id: string;
  title: string;
}

export interface InteractiveListRow extends InteractiveChoice {
  description?: string;
}

export interface InteractiveListSection {
  title?: string;
  rows: InteractiveListRow[];
}

interface InteractiveFrame {
  header?: string;
  footer?: string;
}

export type InteractiveMessage =
  | (InteractiveFrame & { kind: "buttons"; choices: InteractiveChoice[] })
  | (InteractiveFrame & { kind: "list"; buttonText?: string; sections: InteractiveListSection[] });

type Row = Record<string, unknown>;

function rowOf(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null;
}

function filled(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function optional<K extends string>(key: K, value: unknown): Partial<Record<K, string>> {
  const text = filled(value);
  return text === undefined ? {} : ({ [key]: text } as Record<K, string>);
}

function frameOf(block: Row): InteractiveFrame {
  return { ...optional("header", block.header_text), ...optional("footer", block.footer_text) };
}

function choicesOf<T extends InteractiveChoice>(value: unknown, kind: InteractiveChoiceKind, extra: (row: Row) => Partial<T> = () => ({})): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = rowOf(item);
    const id = filled(row?.id);
    const title = filled(row?.title);
    return row && id && title ? [{ kind, id, title, ...extra(row) } as T] : [];
  });
}

function listOf(block: Row): InteractiveMessage | null {
  const sections = (Array.isArray(block.sections) ? block.sections : []).flatMap((item): InteractiveListSection[] => {
    const section = rowOf(item);
    if (!section) return [];
    const rows = choicesOf<InteractiveListRow>(section.rows, "list", (row) => optional("description", row.description));
    return rows.length > 0 ? [{ ...optional("title", section.title), rows }] : [];
  });
  if (sections.length === 0) return null;
  return { kind: "list", ...frameOf(block), ...optional("buttonText", block.button_text), sections };
}

function buttonsOf(block: Row): InteractiveMessage | null {
  const choices = choicesOf<InteractiveChoice>(block.buttons, "button");
  return choices.length > 0 ? { kind: "buttons", ...frameOf(block), choices } : null;
}

export function readInteractiveMessage(metadata: unknown): InteractiveMessage | null {
  const fields = rowOf(metadata);
  if (!fields) return null;
  const list = rowOf(fields.list);
  if (list) return listOf(list);
  const buttons = rowOf(fields.buttons);
  return buttons ? buttonsOf(buttons) : null;
}
