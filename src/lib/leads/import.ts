/**
 * Reading a contact list into leads.
 *
 * Differs from the campaign target list in one deliberate way: columns are
 * MAPPED, not positional. A campaign list is written for the campaign, so
 * "number, name, then variables" is a reasonable contract to state in the UI. A
 * lead import is a file someone exported from another CRM, with its own column
 * order and its own header names, and a positional reader given that file
 * imports the name column as phone numbers, rejects every row, and tells the
 * operator their data is invalid.
 *
 * So: detect the header, guess the mapping from it, and let the operator
 * correct the guess before anything is written.
 */

import { parseDelimitedText, type DelimitedRow } from "@/lib/csv/parse";
import { normalizeBrazilianPhone } from "@/lib/utils";

/** A row that will be sent, already normalized. */
export interface LeadImportRow {
    /** 1-based line in the operator's file, so a rejection points somewhere real. */
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

/**
 * Which column holds what. `null` means "this file does not have that field",
 * which is the normal case for age.
 */
export interface LeadColumnMap {
    number: number;
    name: number | null;
    age: number | null;
}

export interface LeadImportFile {
    /** Header cells, or null when the first row is already data. */
    headers: string[] | null;
    /** Data rows only. The header row, if any, is not among them. */
    rows: DelimitedRow[];
    /** How many columns the widest row has, so the UI can offer them all. */
    columnCount: number;
    /** The mapping guessed from the header, or the positional default. */
    guess: LeadColumnMap;
}

export interface ParsedLeadImport {
    rows: LeadImportRow[];
    rejected: LeadImportRejection[];
    invalid: number;
    duplicates: number;
}

/**
 * Header tokens, by field.
 *
 * Portuguese first because that is what the files say, with the English a
 * second CRM might emit. Deliberately NOT included: "contato", which means the
 * phone number in some exports and the person's name in others, and guessing
 * it either way is worse than leaving that column for the operator to map.
 */
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

/** Lowercased, unaccented and punctuation-free, so "Número " matches "numero". */
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

    // Exact match first: a file with both "nome" and "nome da campanha" should
    // pick "nome", which a substring pass would decide by column order.
    for (const token of tokens) {
        const exact = normalized.indexOf(token);
        if (exact !== -1) return exact;
    }
    for (let i = 0; i < normalized.length; i++) {
        if (tokens.some((token) => normalized[i].includes(token))) return i;
    }
    return null;
}

/**
 * Decides whether the first row is a header.
 *
 * The test is "does it contain a phone number", not "does it look like words":
 * a data row must carry a number to be worth importing, so a first row with
 * none of them is a header, including headers this code has never seen, in a
 * language it does not know.
 */
function looksLikeHeader(row: DelimitedRow): boolean {
    return !row.cells.some((cell) => normalizeBrazilianPhone(cell) !== null);
}

/**
 * Parses the file's structure: header, data rows, and the best guess at which
 * column is which.
 */
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
            // A header we could not read still gets a usable default rather
            // than an unmapped form: first column is the number far more often
            // than not, and the operator can see and change it.
            number: number ?? 0,
            name: name ?? (number === 0 || number === null ? (columnCount > 1 ? 1 : null) : null),
            age,
        };
    } else {
        guess = { number: 0, name: columnCount > 1 ? 1 : null, age: null };
    }

    return { headers, rows, columnCount, guess };
}

/**
 * Applies a column mapping to the data rows.
 *
 * Rejections are collected, never dropped. An operator told "480 importados"
 * out of 500, with no way to see the other 20, has a file they cannot repair,
 * so every skipped line comes back with its number and its reason.
 */
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

        // A number that is not one, or an age nobody has, is dropped without
        // costing the contact: the phone is what makes the lead reachable.
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

/**
 * The example file offered beside the upload control.
 *
 * Semicolon-delimited with a header, because that is what the importer reads
 * back most easily AND what a pt-BR Excel produces. An operator who downloads
 * this, edits it, and uploads it must not have their own template rejected.
 */
export const LEAD_IMPORT_TEMPLATE_COLUMNS = ["telefone", "nome", "idade"] as const;
