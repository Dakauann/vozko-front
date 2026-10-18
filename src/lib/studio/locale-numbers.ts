import { runes } from "./tokens";
import type { IssueCode } from "./validate";

export const COUNTER_LOCALES = ["pt-BR", "en-US", "es-ES", "de-DE"] as const;

export type CounterLocale = (typeof COUNTER_LOCALES)[number];

export const COUNTER_LIMITS = { decimals: [0, 3], affixRunes: 16 } as const;

interface CounterSeparators {
  group: string;
  decimal: string;
}

const SEPARATORS: Record<CounterLocale, CounterSeparators> = {
  "pt-BR": { group: ".", decimal: "," },
  "en-US": { group: ",", decimal: "." },
  "es-ES": { group: ".", decimal: "," },
  "de-DE": { group: ".", decimal: "," },
};

export const COUNTER_MINUS = "-";

const GROUP_EVERY = /\B(?=(\d{3})+(?!\d))/g;

export function isCounterLocale(value: string): value is CounterLocale {
  return (COUNTER_LOCALES as readonly string[]).includes(value);
}

export function counterSeparators(locale: CounterLocale): CounterSeparators {
  return SEPARATORS[locale];
}

export function formatCounterNumber(value: number, decimals: number, locale: CounterLocale, grouping: boolean): string {
  const scale = 10 ** decimals;
  const rounded = Math.round(Math.abs(value) * scale);
  const whole = Math.floor(rounded / scale);
  const fraction = rounded - whole * scale;
  const separators = SEPARATORS[locale];
  const digits = String(whole);
  const grouped = grouping ? digits.replace(GROUP_EVERY, separators.group) : digits;
  const tail = decimals > 0 ? `${separators.decimal}${String(fraction).padStart(decimals, "0")}` : "";
  return `${value < 0 && rounded > 0 ? COUNTER_MINUS : ""}${grouped}${tail}`;
}

function isControl(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029;
}

export function plainTextIssue(text: string | undefined, maxRunes: number): IssueCode | null {
  if (text === undefined) return null;
  if ([...text].some(isControl)) return "invalid";
  return runes(text) > maxRunes ? "too_large" : null;
}

const APP_LOCALES: Record<string, CounterLocale> = { pt: "pt-BR", en: "en-US", es: "es-ES", de: "de-DE" };

export function counterLocaleFor(appLocale: string): CounterLocale {
  return isCounterLocale(appLocale) ? appLocale : (APP_LOCALES[appLocale.split("-")[0]] ?? "pt-BR");
}
