export const ADD_SHEET_ROW_NODE = "action_add_sheet_row";

export const SHEET_ROW_CONFIG_KEYS = ["sheet_id", "values"] as const;

export interface SheetRowConfig {
  sheetId: string;
  values: Record<string, string>;
}

export function readSheetRowConfig(config: Record<string, unknown>): SheetRowConfig {
  const sheetId = typeof config.sheet_id === "string" ? config.sheet_id : "";
  const raw = config.values && typeof config.values === "object" && !Array.isArray(config.values) ? (config.values as Record<string, unknown>) : {};
  const values = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" ? value : String(value ?? "")]));
  return { sheetId, values };
}
