import { defaultLocale, locales, type Locale } from "./config";

import { headers } from "next/headers";

const localeSet = new Set<Locale>(locales);

function isLocale(value: string): value is Locale {
    return localeSet.has(value as Locale);
}

function getLocaleFromAcceptLanguage(acceptLanguage: string): Locale | null {
    const candidates = acceptLanguage
        .split(",")
        .map((part) => part.split(";")[0]?.trim().toLowerCase())
        .filter(Boolean);

    for (const candidate of candidates) {
        if (!candidate) {
            continue;
        }

        if (isLocale(candidate)) {
            return candidate;
        }

        const baseLocale = candidate.split("-")[0];
        if (baseLocale && isLocale(baseLocale)) {
            return baseLocale;
        }
    }

    return null;
}

export async function getRequestLocale(): Promise<Locale> {
    const headerList = await headers();
    const cookieHeader = headerList.get("cookie") ?? "";
    const cookieLocale = cookieHeader.match(
        /(?:^|;\s*)NEXT_LOCALE=(pt|en|de|es)(?:;|$)/,
    )?.[1];

    if (cookieLocale && isLocale(cookieLocale)) {
        return cookieLocale;
    }

    const acceptLanguage = headerList.get("accept-language") ?? "";
    return getLocaleFromAcceptLanguage(acceptLanguage) ?? defaultLocale;
}