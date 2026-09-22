
export type CsvCell = string | number | boolean | null | undefined;

export const CSV_DELIMITER = ";";

export const CSV_DECIMAL = ",";

export interface CsvSection {
    title?: string;
    header?: string[];
    rows: CsvCell[][];
}

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

export function csvNumber(value: number | null | undefined, decimals = 2): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "";
    const rounded = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(decimals)));
    return rounded.replace(".", CSV_DECIMAL);
}

export function escapeCsvCell(cell: CsvCell): string {
    if (cell === null || cell === undefined) return "";
    if (typeof cell === "number") return csvNumber(cell);
    if (typeof cell === "boolean") return cell ? "true" : "false";

    const text = safeCsvText(cell);
    const needsQuotes =
        text.includes(CSV_DELIMITER) || /["\n\r]/.test(text) || text !== text.trim();
    return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

function renderRow(cells: CsvCell[]): string {
    return cells.map(escapeCsvCell).join(CSV_DELIMITER);
}

export const UTF8_BOM = "﻿";

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

export function csvFilename(...parts: Array<string | undefined | null>): string {
    const slug = parts
        .filter((p): p is string => !!p && p.trim() !== "")
        .join("-")
        .replace(/[^a-zA-Z0-9\-_.]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    return `${slug || "export"}.csv`;
}
