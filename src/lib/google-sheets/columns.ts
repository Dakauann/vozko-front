import type { GoogleSheet, SheetColumn } from "@/lib/google-sheets/types";

export function mappedColumns(sheet: GoogleSheet): SheetColumn[] {
  return sheet.columns.filter((column) => column.source === "input" && !column.archived);
}

export function systemColumns(sheet: GoogleSheet): SheetColumn[] {
  return sheet.columns.filter((column) => column.source !== "input" && !column.archived);
}
