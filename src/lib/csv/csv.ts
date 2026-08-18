/**
 * CSV building for files produced in the browser.
 *
 * Shares the server-side export's defences (RFC 4180 quoting, the same
 * formula-injection guard, a UTF-8 BOM so Excel reads accented Portuguese
 * instead of mojibake) but deliberately differs on one point: the delimiter.
 *
 * The server export is comma-delimited. Double-clicking a comma-delimited file
 * on Portuguese Windows drops every row into a single column, because Excel
 * splits on the regional list separator, which is a semicolon there. So these
 * files use `;` with `,` decimals — the pt-BR spreadsheet convention. Google
 * Sheets auto-detects either, so nothing is lost for that audience.
 *
 * The pairing is not optional: with `;` separating fields, `,` is free to be
 * the decimal mark, and 30,05 arrives as a NUMBER the sheet can average.
 * Mixing the two conventions would produce text that breaks every formula the
 * operator writes against the file.
 */

export type CsvCell = string | number | boolean | null | undefined;

/** Field separator. See the note above before changing it. */
export const CSV_DELIMITER = ";";

/** Decimal mark, paired with CSV_DELIMITER. */
export const CSV_DECIMAL = ",";

/**
 * A block of rows under an optional title and header.
 *
 * Sections exist because an operations report is not one rectangle: KPIs are
 * key/value, the attendant table is a grid, and the hourly curve is a series.
 * Flattening them into a single shape would make the file unreadable in the
 * spreadsheet it is opened in, which is the only place it is ever opened.
 */
export interface CsvSection {
    title?: string;
    header?: string[];
    rows: CsvCell[][];
}

/**
 * safeCsvText prepares a free-text cell for a spreadsheet.
 *
 * Newlines are flattened so one record stays one line. The leading apostrophe
 * is formula-injection defence: Excel and Sheets execute a cell beginning with
 * =, +, -, @, tab or CR, and the names reaching this file (departments,
 * attendants, channels) are typed by people. A crafted name would otherwise
 * run as a formula on the machine of whoever opens the export.
 *
 * Kept byte-for-byte equivalent to safeCSVText in the Go exporter, so both
 * halves of the product defend identically.
 */
export function safeCsvText(value: string): string {
    const flattened = value.replace(/\r\n/g, " ").replace(/[\n\r]/g, " ");
    if (flattened === "") return flattened;
    switch (flattened[0]) {
        case "=":
        case "+":
        case "-":
        case "@":
        case "\t":
            return `'${flattened}`;
        default:
            return flattened;
    }
}

/**
 * csvNumber renders a number for a spreadsheet CELL, not for a human.
 *
 * Comma decimal mark (paired with the semicolon delimiter) and no thousands
 * grouping. Grouping is what would make it text: "1.234,5" is not a number to
 * any locale reading this file, whereas 1234,5 is one to the pt-BR sheet these
 * exports are opened in.
 */
export function csvNumber(value: number | null | undefined, decimals = 2): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "";
    const rounded = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(decimals)));
    return rounded.replace(".", CSV_DECIMAL);
}

/** escapeCsvCell applies RFC 4180 quoting to one already-safe cell. */
export function escapeCsvCell(cell: CsvCell): string {
    if (cell === null || cell === undefined) return "";
    if (typeof cell === "number") return csvNumber(cell);
    if (typeof cell === "boolean") return cell ? "true" : "false";

    const text = safeCsvText(cell);
    // Quoted on the DELIMITER only, never on the decimal mark: quoting "30,05"
    // would hand Excel a string where a number was intended. Leading/trailing
    // spaces are quoted too, since some parsers trim otherwise.
    const needsQuotes =
        text.includes(CSV_DELIMITER) || /["\n\r]/.test(text) || text !== text.trim();
    return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

function renderRow(cells: CsvCell[]): string {
    return cells.map(escapeCsvCell).join(CSV_DELIMITER);
}

/** UTF-8 BOM. Excel needs it to read the file as UTF-8 rather than Latin-1. */
export const UTF8_BOM = "﻿";

/**
 * buildCsvDocument renders sections into one file, separated by a blank line.
 *
 * CRLF line endings, per RFC 4180 and because Excel on Windows is the most
 * common destination.
 */
export function buildCsvDocument(sections: CsvSection[], withBom = true): string {
    const blocks: string[] = [];

    for (const section of sections) {
        const lines: string[] = [];
        if (section.title) lines.push(renderRow([section.title]));
        if (section.header) lines.push(renderRow(section.header));
        for (const row of section.rows) lines.push(renderRow(row));
        if (lines.length > 0) blocks.push(lines.join("\r\n"));
    }

    const body = blocks.join("\r\n\r\n");
    const text = body === "" ? "" : `${body}\r\n`;
    return withBom ? UTF8_BOM + text : text;
}

/**
 * csvFilename builds a download name that cannot carry path or header
 * separators, matching sanitizeFilenamePart on the server.
 */
export function csvFilename(...parts: Array<string | undefined | null>): string {
    const slug = parts
        .filter((p): p is string => !!p && p.trim() !== "")
        .join("-")
        .replace(/[^a-zA-Z0-9\-_.]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    return `${slug || "export"}.csv`;
}
