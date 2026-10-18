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
    }).format(brlValue);
}

export function formatCentsAsBrl(cents: number, locale: string): string {
    return new Intl.NumberFormat(locale === 'pt' ? 'pt-BR' : locale, {
        style: 'currency',
        currency: 'BRL',
    }).format(cents / 100);
}
