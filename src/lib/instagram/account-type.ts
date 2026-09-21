import type { useTranslations } from 'next-intl';

export function translateAccountType(
    t: ReturnType<typeof useTranslations>,
    accountType: string | null | undefined,
): string {
    const value = accountType?.trim();
    if (!value) return t('accountType.unknown');

    const key = `accountType.${value.toUpperCase()}`;
    return t.has(key) ? t(key) : t('accountType.unknown');
}
