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

export function formatMicrosToUSD(micros: number): string {
    const usd = micros / 1_000_000;
    return `$${usd.toFixed(6)}`;
}
