import { buildCsvDocument } from "@/lib/csv/csv";
import { downloadCsv } from "@/lib/browser/download";

import { LEAD_IMPORT_TEMPLATE_COLUMNS } from "./import";

const TEMPLATE_ROWS: (string | number)[][] = [
  ["5511987654321", "Ana Maria", 34],
  ["+55 (11) 98765-4322", "Bruno Alves", ""],
  ["11987654323", "Carla Souza; ME", 41],
];

export function buildLeadImportTemplate(): string {
  return buildCsvDocument([
    {
      header: [...LEAD_IMPORT_TEMPLATE_COLUMNS],
      rows: TEMPLATE_ROWS,
    },
  ]);
}

export const LEAD_IMPORT_TEMPLATE_FILENAME = "leads-modelo.csv";

export function downloadLeadImportTemplate(): void {
  downloadCsv(buildLeadImportTemplate(), LEAD_IMPORT_TEMPLATE_FILENAME);
}
