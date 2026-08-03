import type { useTranslations } from 'next-intl';

/**
 * Translates Instagram's account_type.
 *
 * The value is an upstream enum, not free text, so it is translated rather than
 * shown raw, "MEDIA_CREATOR" in a Portuguese dashboard is an untranslated string
 * leaking through. Unknown values fall back to a neutral label instead of the raw
 * enum, because Meta has added values before without notice: this account reports
 * MEDIA_CREATOR, which their own docs do not list.
 */
export function translateAccountType(
    t: ReturnType<typeof useTranslations>,
    accountType: string | null | undefined,
): string {
    const value = accountType?.trim();
    if (!value) return t('accountType.unknown');

    const key = `accountType.${value.toUpperCase()}`;
    return t.has(key) ? t(key) : t('accountType.unknown');
}
