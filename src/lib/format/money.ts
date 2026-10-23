export const MAX_MONEY_FRACTION_DIGITS = 4;

function scaled(value: number, digits: number): number {
    return Math.round(value * 10 ** digits);
}

function hiddenAt(value: number, digits: number, distinctFrom?: number): boolean {
    if (value !== 0 && scaled(value, digits) === 0) return true;
    return distinctFrom !== undefined && value !== distinctFrom && scaled(value, digits) === scaled(distinctFrom, digits);
}

export function visibleFractionDigits(value: number, digits: number, distinctFrom?: number): number {
    return hiddenAt(value, digits, distinctFrom) ? Math.max(digits, MAX_MONEY_FRACTION_DIGITS) : digits;
}

export function formatMicrosToMoney(
    micros: number,
    exchangeRate: number,
    locale: string,
): string {
    const usdValue = micros / 1_000_000;
    const brlValue = usdValue * exchangeRate;
    return new Intl.NumberFormat(locale === 'pt' ? 'pt-BR' : 'en-US', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: visibleFractionDigits(brlValue, 2),
    }).format(brlValue);
}

export function formatCentsAsBrl(cents: number, locale: string): string {
    return new Intl.NumberFormat(locale === 'pt' ? 'pt-BR' : locale, {
        style: 'currency',
        currency: 'BRL',
    }).format(cents / 100);
}
