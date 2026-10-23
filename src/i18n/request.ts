import { humanizeMessageKey, reportMessageError } from './fallback';
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { TIME_ZONE_COOKIE, knownTimeZone } from './time-zone';
import { routing } from './routing';
import { getBrand } from '@/config/brand';
import { applyBrand } from './apply-brand';

export default getRequestConfig(async ({ requestLocale }) => {

    let locale = await requestLocale;

    if (!locale || !routing.locales.includes(locale as typeof routing.locales[number])) {
        locale = routing.defaultLocale;
    }

    const messages = (await import(`./messages/${locale}.json`)).default;

    return {
        locale,
        messages: applyBrand(messages, getBrand(), locale),
        timeZone: knownTimeZone((await cookies()).get(TIME_ZONE_COOKIE)?.value),
        onError: reportMessageError,
        getMessageFallback({ key }) {
            return humanizeMessageKey(key);
        },
    };
});
