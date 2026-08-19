/**
 * Money in this product is stored as USD micros and shown in BRL.
 *
 * Both halves of that sentence matter. The ledger, every price and every balance
 * are micros of a dollar; the operator has only ever seen reais. Anything that
 * divides micros by a million and slaps "R$" on the result is showing a number
 * that is roughly five times too small — which, for a screen whose whole job is
 * to get consent to spend, is worse than showing nothing.
 *
 * The rate is a configured value fetched from the API, not a constant, because
 * it is set by the platform and changes.
 */

/** USD micros to whole USD. */
export function microsToUsd(micros: number): number {
    return micros / 1_000_000;
}

/** The exchange rate is itself stored as micros: 5_500_000 means 5.50 BRL per USD. */
export function exchangeRateFromMicros(priceMicros: number | null | undefined): number | null {
    if (!priceMicros || priceMicros <= 0) return null;
    return priceMicros / 1_000_000;
}

/**
 * USD micros to BRL, or null when the rate is unknown.
 *
 * Returning null rather than falling back to a rate of 1 is deliberate: a
 * missing rate is a fact we do not have, and quietly substituting the dollar
 * figure would print a confident, wrong price.
 */
export function microsToBrl(micros: number, exchangeRate: number | null): number | null {
    if (exchangeRate === null) return null;
    return microsToUsd(micros) * exchangeRate;
}

export function formatBrl(value: number, locale = "pt-BR"): string {
    return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(value);
}

/** The whole conversion, for callers that just want a string or nothing. */
export function formatMicrosAsBrl(
    micros: number | null | undefined,
    exchangeRate: number | null,
    locale = "pt-BR",
): string | null {
    if (micros === null || micros === undefined || micros <= 0) return null;
    const converted = microsToBrl(micros, exchangeRate);
    return converted === null ? null : formatBrl(converted, locale);
}
