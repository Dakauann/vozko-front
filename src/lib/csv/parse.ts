
export function splitCells(line: string, delimiter: string): string[] {
    const cells: string[] = [];
    let current = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
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

export function detectDelimiter(line: string): string {
    if (line.includes("\t")) return "\t";
    if (line.includes(";")) return ";";
    return ",";
}

export interface DelimitedRow {
    line: number;
    cells: string[];
    raw: string;
}

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

const BOM = "﻿";

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
