const EMPTY_VALUES: Record<string, string> = {
  pt: "n/d",
  en: "n/a",
  es: "n/d",
  de: "k. A.",
};

const FALLBACK_LANGUAGE = "en";

export function emptyValue(locale: string): string {
  const language = locale.split("-")[0].toLowerCase();
  return EMPTY_VALUES[language] ?? EMPTY_VALUES[FALLBACK_LANGUAGE];
}
