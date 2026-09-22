
export const MICROS = 1_000_000;

export const DEFAULT_USD_TO_BRL = 6.0;

export function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(/,/g, ".");
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

export function microsToUsdNumber(micros: number): number {
  return micros / MICROS;
}

export function microsToUsdDisplay(micros: number): string {
  return microsToUsdNumber(micros)
    .toFixed(6)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

export function usdToMicros(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) return 0;
  return Math.round(usd * MICROS);
}

export function parseUsdToMicros(value: string): number {
  const n = parseAmount(value);
  if (n === null) return 0;
  return usdToMicros(n);
}

export function resolveExchangeRate(rate: number | null | undefined): number | null {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}

export function usdMicrosToBrl(micros: number, rate: number): number {
  return microsToUsdNumber(micros) * rate;
}

export function brlToUsdMicros(brl: number, rate: number): number {
  if (!Number.isFinite(brl) || brl < 0 || !Number.isFinite(rate) || rate <= 0) {
    return 0;
  }
  return Math.round((brl / rate) * MICROS);
}

export function parseBrlToUsdMicros(value: string, rate: number): number {
  const n = parseAmount(value);
  if (n === null) return 0;
  return brlToUsdMicros(n, rate);
}

export function brlToInputDisplay(brl: number): string {
  if (!Number.isFinite(brl) || brl === 0) return "0";
  return brl.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

export function usdMicrosToBrlInput(micros: number, rate: number): string {
  return brlToInputDisplay(usdMicrosToBrl(micros, rate));
}

export function formatBrlCurrency(brl: number, fractionDigits = 4): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: Math.min(2, fractionDigits),
    maximumFractionDigits: fractionDigits,
  }).format(brl);
}

export function formatUsdCurrency(usd: number, fractionDigits = 6): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(usd);
}

export function formatUsdMicrosAsUsd(micros: number): string {
  return formatUsdCurrency(microsToUsdNumber(micros));
}

export function formatUsdMicrosAsBrl(micros: number, rate: number): string {
  return formatBrlCurrency(usdMicrosToBrl(micros, rate));
}

export function isPercentageMetric(metric: string): boolean {
  return metric === "percentage";
}
