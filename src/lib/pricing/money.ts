/** USD micros are the billing source of truth. BRL is admin input/display only. */

export const MICROS = 1_000_000;

export const DEFAULT_USD_TO_BRL = 6.0;

/** Parse a user amount that may use comma or dot as decimal separator. */
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

/** Compact USD string for display (no trailing zeros). */
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

/** Resolve a positive USD→BRL rate; null when invalid. */
export function resolveExchangeRate(rate: number | null | undefined): number | null {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}

export function usdMicrosToBrl(micros: number, rate: number): number {
  return microsToUsdNumber(micros) * rate;
}

/** Convert BRL amount to USD micros using the system rate. */
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

/** Compact BRL display string (dot decimal, trimmed zeros) for form inputs. */
export function brlToInputDisplay(brl: number): string {
  if (!Number.isFinite(brl) || brl === 0) return "0";
  // Keep up to 6 decimals for tiny unit prices; strip trailing zeros.
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

/** True when the metric is percentage based (no money conversion). */
export function isPercentageMetric(metric: string): boolean {
  return metric === "percentage";
}
