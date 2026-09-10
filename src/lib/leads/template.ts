import { buildCsvDocument } from "@/lib/csv/csv";
import { downloadCsv } from "@/lib/browser/download";

import { LEAD_IMPORT_TEMPLATE_COLUMNS } from "./import";

/**
 * The example import file.
 *
 * Lives here rather than inside the import dialog because two places offer it
 * now — the dialog, and the leads page header for an operator who wants the
 * model before committing to the flow. Two copies of the rows would drift, and
 * the one that drifted would be the one teaching people the wrong format.
 *
 * It has to survive its own round trip: an operator downloads this, edits it in
 * Excel and uploads it, so every row must import cleanly. That rules out
 * explanatory comment lines, which would come back as rejected rows next time.
 * The explanation belongs in the dialog, where it can be read without opening a
 * spreadsheet.
 *
 * The rows are chosen to answer what the mapping screen otherwise gets asked:
 *
 * - punctuation and a leading +55 are fine, the server normalises them;
 * - `idade` is optional and an empty cell is not a rejection;
 * - a name containing the `;` delimiter still lands in one column, because
 *   renderRow quotes it. That last row is the one that catches a broken
 *   delimiter guess immediately rather than on row four thousand.
 */
const TEMPLATE_ROWS: (string | number)[][] = [
  ["5511987654321", "Ana Maria", 34],
  ["+55 (11) 98765-4322", "Bruno Alves", ""],
  ["11987654323", "Carla Souza; ME", 41],
];

/** The example file's contents, as CSV text. Exported for tests. */
export function buildLeadImportTemplate(): string {
  return buildCsvDocument([
    {
      header: [...LEAD_IMPORT_TEMPLATE_COLUMNS],
      rows: TEMPLATE_ROWS,
    },
  ]);
}

/** Filename the operator sees. Portuguese, like the columns. */
export const LEAD_IMPORT_TEMPLATE_FILENAME = "leads-modelo.csv";

/** Builds the example file and hands it to the browser. */
export function downloadLeadImportTemplate(): void {
  downloadCsv(buildLeadImportTemplate(), LEAD_IMPORT_TEMPLATE_FILENAME);
}
