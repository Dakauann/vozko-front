import { emptyValue } from "@/lib/format/empty-value";

const MICROS_PER_UNIT = 1_000_000;

const ZERO_DECIMAL_CURRENCIES = new Set(["CLP", "COP", "CRC", "HUF", "ISK", "IDR", "JPY", "KRW", "PYG", "TWD", "VND"]);

export function normalizeCurrency(code: string | null | undefined): string | null {
  const upper = (code ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(upper) ? upper : null;
}

export function currencyOffset(code: string): number | null {
  const normalized = normalizeCurrency(code);
  if (!normalized) return null;
  return ZERO_DECIMAL_CURRENCIES.has(normalized) ? 1 : 100;
}

export function currencyFractionDigits(code: string): number {
  return currencyOffset(code) === 1 ? 0 : 2;
}

function currencyFormatter(currency: string, locale: string, fractionDigits?: number): Intl.NumberFormat | null {
  const normalized = normalizeCurrency(currency);
  if (!normalized) return null;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalized,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  } catch {
    return null;
  }
}

export function formatMicros(micros: number | null | undefined, currency: string, locale = "pt-BR", fractionDigits?: number): string {
  if (micros === null || micros === undefined || !Number.isFinite(micros)) return emptyValue(locale);
  const formatter = currencyFormatter(currency, locale, fractionDigits);
  return formatter ? formatter.format(micros / MICROS_PER_UNIT) : emptyValue(locale);
}

export function formatMinor(minor: number | null | undefined, currency: string, locale = "pt-BR"): string {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return emptyValue(locale);
  const offset = currencyOffset(currency);
  const formatter = currencyFormatter(currency, locale, currencyFractionDigits(currency));
  if (!offset || !formatter) return emptyValue(locale);
  return formatter.format(minor / offset);
}

export function minorToInput(minor: number, currency: string): string {
  const offset = currencyOffset(currency);
  if (!offset || !Number.isFinite(minor) || minor <= 0) return "";
  const digits = currencyFractionDigits(currency);
  return (minor / offset).toFixed(digits).replace(".", ",");
}

export function inputToMinor(raw: string, currency: string): number | null {
  const offset = currencyOffset(currency);
  if (!offset) return null;
  const compact = raw.trim().replace(/\s/g, "");
  if (compact === "") return null;
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  const decimalAt = Math.max(lastComma, lastDot);
  const digitsAfter = decimalAt >= 0 ? compact.length - decimalAt - 1 : 0;
  const hasDecimal = decimalAt >= 0 && digitsAfter > 0 && digitsAfter <= 2;
  const whole = hasDecimal ? compact.slice(0, decimalAt) : compact;
  const fraction = hasDecimal ? compact.slice(decimalAt + 1) : "";
  const wholeDigits = whole.replace(/[.,]/g, "");
  if (!/^\d+$/.test(wholeDigits) || (fraction !== "" && !/^\d+$/.test(fraction))) return null;
  const value = Number(`${wholeDigits}.${fraction || "0"}`);
  const minor = Math.round(value * offset);
  return minor > 0 ? minor : null;
}

export function formatCount(value: number | null | undefined, locale = "pt-BR"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return emptyValue(locale);
  return new Intl.NumberFormat(locale).format(value);
}

export function formatPercent(value: number | null | undefined, locale = "pt-BR"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return emptyValue(locale);
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
}

export function formatRoas(value: number | null | undefined, locale = "pt-BR"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return emptyValue(locale);
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}x`;
}

export function formatDecimal(value: number | null | undefined, locale = "pt-BR", digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return emptyValue(locale);
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}
