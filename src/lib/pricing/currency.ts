
export function microsToUsd(micros: number): number {
    return micros / 1_000_000;
}

export function exchangeRateFromMicros(priceMicros: number | null | undefined): number | null {
    if (!priceMicros || priceMicros <= 0) return null;
    return priceMicros / 1_000_000;
}

export function microsToBrl(micros: number, exchangeRate: number | null): number | null {
    if (exchangeRate === null) return null;
    return microsToUsd(micros) * exchangeRate;
}

export function formatBrl(value: number, locale = "pt-BR"): string {
    return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(value);
}

export function formatMicrosAsBrl(
    micros: number | null | undefined,
    exchangeRate: number | null,
    locale = "pt-BR",
): string | null {
    if (micros === null || micros === undefined || micros <= 0) return null;
    const converted = microsToBrl(micros, exchangeRate);
    return converted === null ? null : formatBrl(converted, locale);
}
