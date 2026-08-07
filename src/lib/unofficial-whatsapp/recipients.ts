/**
 * Recipient list parsing.
 *
 * Shared rather than inlined because the normalisation has to match what the
 * server will do with the number: an operator who types a number one way and
 * sees it resolve another way has no way to tell a typo from a rewrite.
 *
 * Deliberately permissive about SHAPE and strict about the result. Operators
 * paste from spreadsheets, CRMs and WhatsApp itself, so separators, `+` signs,
 * parentheses and dashes all arrive — but anything that does not reduce to a
 * plausible international number is reported rather than silently dropped.
 */

/** Brazil's shortest mobile is 12 digits with the country code; 15 is E.164's ceiling. */
const MIN_DIGITS = 10;
const MAX_DIGITS = 15;

export interface ParsedRecipients {
    /** Unique, normalized, in the order they were first seen. */
    valid: string[];
    /** How many lines repeated a number already in the list. */
    duplicates: number;
    /** How many non-empty lines could not be read as a number at all. */
    invalid: number;
}

/**
 * Splits a pasted blob into numbers.
 *
 * Order is preserved because an operator who sorted their list expects the send
 * to follow it, and because a stable order makes a partially-sent run
 * comprehensible when they come back to it.
 */
export function normalizeRecipients(raw: string): ParsedRecipients {
    const seen = new Set<string>();
    const valid: string[] = [];
    let duplicates = 0;
    let invalid = 0;

    // Anything that is not a digit or a separator is a separator: a pasted
    // column brings tabs, semicolons and quotes with it.
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
