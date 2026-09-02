/**
 * Reading delimited text produced by a spreadsheet.
 *
 * The counterpart to `csv.ts`, which WRITES files. These two must agree about
 * what a quoted field means, and everything that reads a pasted or uploaded
 * contact list must agree with both. A campaign target list and a lead import
 * that disagree about a trailing separator would accept different halves of the
 * same file, which is the kind of difference nobody finds until a campaign goes
 * out short.
 */

/**
 * Splits one line into cells, respecting quotes.
 *
 * Quote-aware because this is a Brazilian collections product: a value like
 * `R$ 1.234,56` uses the comma as its DECIMAL separator, and a naive split would
 * turn one amount into two columns and shift every field after it. A spreadsheet
 * exports that as `"R$ 1.234,56"`, and this respects it.
 */
export function splitCells(line: string, delimiter: string): string[] {
    const cells: string[] = [];
    let current = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            // A doubled quote inside a quoted field is one literal quote.
            if (quoted && line[i + 1] === '"') {
                current += '"';
                i++;
                continue;
            }
            quoted = !quoted;
            continue;
        }
        if (ch === delimiter && !quoted) {
            cells.push(current.trim());
            current = "";
            continue;
        }
        current += ch;
    }
    cells.push(current.trim());
    return cells;
}

/**
 * Picks the delimiter a line actually uses.
 *
 * Tab and semicolon win over comma when present, and that order is not
 * arbitrary: a pt-BR spreadsheet exports with semicolons precisely BECAUSE the
 * comma is the decimal separator, so a line containing both is far more likely
 * to be semicolon-delimited with a decimal comma inside a value.
 */
export function detectDelimiter(line: string): string {
    if (line.includes("\t")) return "\t";
    if (line.includes(";")) return ";";
    return ",";
}

/** One row of a delimited file, carrying the line number it came from. */
export interface DelimitedRow {
    /** 1-based line in the operator's file, blank lines included. */
    line: number;
    cells: string[];
    raw: string;
}

/**
 * Parses a whole blob into rows.
 *
 * The delimiter is decided ONCE, from the first non-empty line, rather than per
 * line. Deciding per line lets one row containing a stray semicolon be split
 * differently from its neighbours, which silently shifts that row's columns:
 * a name lands in the phone column and the row is rejected as invalid while
 * looking perfectly fine in the spreadsheet.
 *
 * Blank lines are skipped but still consume a line number, so a rejection
 * reported as "line 42" is line 42 in the file the operator has open.
 */
export function parseDelimitedText(raw: string): DelimitedRow[] {
    const lines = raw.split(/\r?\n/);
    const firstContent = lines.find((line) => line.trim() !== "");
    if (firstContent === undefined) return [];

    const delimiter = detectDelimiter(firstContent);

    const rows: DelimitedRow[] = [];
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed === "") return;
        rows.push({ line: index + 1, cells: splitCells(trimmed, delimiter), raw: trimmed });
    });
    return rows;
}

/** UTF-8 byte-order mark, which Excel writes and no parser wants to see. */
const BOM = "﻿";

/**
 * Reads an uploaded file as text, guessing its encoding.
 *
 * `File.text()` always decodes as UTF-8, and Excel on a Portuguese Windows
 * still saves CSV as Windows-1252 by default. Decoded as UTF-8 that file turns
 * every accented name into mojibake ("José" becomes "Jos?"), and those names
 * are then stored that way, on the lead, forever. So: try UTF-8 strictly, and
 * fall back to Windows-1252 when the bytes are not valid UTF-8.
 *
 * The fallback is safe in one direction only, which is why the order matters:
 * every byte sequence is *valid* Windows-1252, so trying it first would never
 * fail over to UTF-8 and would corrupt every correctly-encoded file instead.
 */
export async function readDelimitedFile(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();

    let text: string;
    try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
        text = new TextDecoder("windows-1252").decode(buffer);
    }

    return text.startsWith(BOM) ? text.slice(BOM.length) : text;
}
