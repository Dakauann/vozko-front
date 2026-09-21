
const MIN_DIGITS = 10;
const MAX_DIGITS = 15;

export interface ParsedRecipients {
    valid: string[];
    duplicates: number;
    invalid: number;
}

export function normalizeRecipients(raw: string): ParsedRecipients {
    const seen = new Set<string>();
    const valid: string[] = [];
    let duplicates = 0;
    let invalid = 0;

    for (const line of raw.split(/[\n,;]+/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const digits = trimmed.replace(/\D/g, "");
        if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) {
            invalid += 1;
            continue;
        }
        if (seen.has(digits)) {
            duplicates += 1;
            continue;
        }
        seen.add(digits);
        valid.push(digits);
    }

    return { valid, duplicates, invalid };
}
