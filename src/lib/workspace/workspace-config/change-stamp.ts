export interface ChangeStamp {
  by: string | null;
  at: string;
}

const STAMP_FIELDS = ["ChangedBy", "ChangedByName", "ChangedAt"] as const;

type Read = { ok: boolean; text?: string };

export function readOptionalText(value: unknown): Read {
  if (value === undefined || value === null) return { ok: true };
  if (typeof value !== "string") return { ok: false };
  return { ok: true, text: value === "" ? undefined : value };
}

export function readOptionalInstant(value: unknown): Read {
  const read = readOptionalText(value);
  if (!read.ok || read.text === undefined) return read;
  return Number.isNaN(Date.parse(read.text)) ? { ok: false } : read;
}

export function readChangeStampFields(raw: Record<string, unknown>, prefix: string): Record<string, string | undefined> | null {
  const fields: Record<string, string | undefined> = {};
  for (const field of STAMP_FIELDS) {
    const key = `${prefix}${field}`;
    const read = field === "ChangedAt" ? readOptionalInstant(raw[key]) : readOptionalText(raw[key]);
    if (!read.ok) return null;
    fields[key] = read.text;
  }
  return fields;
}

export function changeStampOf(record: object, prefix: string): ChangeStamp | null {
  const fields = record as Record<string, unknown>;
  const at = fields[`${prefix}ChangedAt`];
  if (typeof at !== "string") return null;
  const by = fields[`${prefix}ChangedByName`];
  return { by: typeof by === "string" ? by : null, at };
}
