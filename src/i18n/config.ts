export const locales = ['pt', 'en', 'de', 'es'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'pt';

export const localeNames: Record<Locale, string> = {
    pt: 'Português',
    en: 'English',
    de: 'Deutsch',
    es: 'Español',
};

export const localeFlags: Record<Locale, string> = {
    pt: 'PT',
    en: 'EN',
    de: 'DE',
    es: 'ES',
};
