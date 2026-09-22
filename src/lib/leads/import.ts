
import { parseDelimitedText, type DelimitedRow } from "@/lib/csv/parse";
import { normalizeBrazilianPhone } from "@/lib/utils";

export interface LeadImportRow {
    line: number;
    number: string;
    name?: string;
    age?: number;
}

export type LeadImportRejectReason = "invalid" | "duplicate";

export interface LeadImportRejection {
    line: number;
    raw: string;
    reason: LeadImportRejectReason;
}

export interface LeadColumnMap {
    number: number;
    name: number | null;
    age: number | null;
}

export interface LeadImportFile {
    headers: string[] | null;
    rows: DelimitedRow[];
    columnCount: number;
    guess: LeadColumnMap;
}

export interface ParsedLeadImport {
    rows: LeadImportRow[];
    rejected: LeadImportRejection[];
    invalid: number;
    duplicates: number;
}

const NUMBER_TOKENS = [
    "telefone",
    "telefones",
    "fone",
    "celular",
    "whatsapp",
    "whats",
    "numero",
    "número",
    "num",
    "phone",
    "mobile",
    "msisdn",
];

const NAME_TOKENS = [
    "nome",
    "nome completo",
    "cliente",
    "razao social",
    "razão social",
    "name",
    "full name",
    "customer",
];

const AGE_TOKENS = ["idade", "age"];

function normalizeHeader(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function matchColumn(headers: string[], tokens: string[]): number | null {
    const normalized = headers.map(normalizeHeader);

    for (const token of tokens) {
        const exact = normalized.indexOf(token);
        if (exact !== -1) return exact;
    }
    for (let i = 0; i < normalized.length; i++) {
        if (tokens.some((token) => normalized[i].includes(token))) return i;
    }
    return null;
}

function looksLikeHeader(row: DelimitedRow): boolean {
    return !row.cells.some((cell) => normalizeBrazilianPhone(cell) !== null);
}

export function readLeadImportFile(raw: string): LeadImportFile {
    const all = parseDelimitedText(raw);
    if (all.length === 0) {
        return {
            headers: null,
            rows: [],
            columnCount: 0,
            guess: { number: 0, name: 1, age: null },
        };
    }

    const hasHeader = looksLikeHeader(all[0]);
    const headers = hasHeader ? all[0].cells : null;
    const rows = hasHeader ? all.slice(1) : all;
    const columnCount = Math.max(
        headers?.length ?? 0,
        ...rows.map((row) => row.cells.length),
        1,
    );

    let guess: LeadColumnMap;
    if (headers) {
        const number = matchColumn(headers, NUMBER_TOKENS);
        const name = matchColumn(headers, NAME_TOKENS);
        const age = matchColumn(headers, AGE_TOKENS);
        guess = {
            number: number ?? 0,
            name: name ?? (number === 0 || number === null ? (columnCount > 1 ? 1 : null) : null),
            age,
        };
    } else {
        guess = { number: 0, name: columnCount > 1 ? 1 : null, age: null };
    }

    return { headers, rows, columnCount, guess };
}

export function buildLeadImportRows(
    file: LeadImportFile,
    map: LeadColumnMap,
): ParsedLeadImport {
    const rows: LeadImportRow[] = [];
    const rejected: LeadImportRejection[] = [];
    const seen = new Set<string>();
    let invalid = 0;
    let duplicates = 0;

    for (const row of file.rows) {
        const rawNumber = row.cells[map.number] ?? "";
        const number = normalizeBrazilianPhone(rawNumber);

        if (!number) {
            invalid += 1;
            rejected.push({ line: row.line, raw: row.raw, reason: "invalid" });
            continue;
        }
        if (seen.has(number)) {
            duplicates += 1;
            rejected.push({ line: row.line, raw: row.raw, reason: "duplicate" });
            continue;
        }
        seen.add(number);

        const name = map.name === null ? "" : (row.cells[map.name] ?? "").trim();

        let age: number | undefined;
        if (map.age !== null) {
            const parsed = Number.parseInt((row.cells[map.age] ?? "").trim(), 10);
            if (Number.isFinite(parsed) && parsed > 0 && parsed <= 130) age = parsed;
        }

        rows.push({
            line: row.line,
            number,
            ...(name ? { name } : {}),
            ...(age !== undefined ? { age } : {}),
        });
    }

    return { rows, rejected, invalid, duplicates };
}

export const LEAD_IMPORT_TEMPLATE_COLUMNS = ["telefone", "nome", "idade"] as const;

export const MAX_SEEDED_CONVERSATIONS = 200;

export function countRowsWithoutName(
    rows: LeadImportRow[],
    limit = MAX_SEEDED_CONVERSATIONS,
): number {
    let missing = 0;
    for (const row of rows.slice(0, Math.max(0, limit))) {
        if (!row.name || row.name.trim() === "") missing += 1;
    }
    return missing;
}
