import { humanizeMessageKey, reportMessageError } from './fallback';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { getBrand } from '@/config/brand';

function applyBrand<T>(messages: T): T {
    const brand = getBrand();
    const tokens: Record<string, string> = {
        '{brandName}': brand.name,
        '{brandLegalName}': brand.legalName,
        '{brandCnpj}': brand.cnpj,
        '{brandSupportEmail}': brand.supportEmail,
        '{brandContactEmail}': brand.contactEmail,
        '{brandDpoEmail}': brand.dpoEmail,
        '{brandPhone}': brand.phone,
        '{brandSiteUrl}': brand.siteUrl,
        '{brandAiName}': brand.aiName,
    };
    let json = JSON.stringify(messages);
    for (const [token, value] of Object.entries(tokens)) {
        const escaped = JSON.stringify(value).slice(1, -1);
        json = json.split(token).join(escaped);
    }
    return JSON.parse(json) as T;
}

export default getRequestConfig(async ({ requestLocale }) => {

    let locale = await requestLocale;

    if (!locale || !routing.locales.includes(locale as typeof routing.locales[number])) {
        locale = routing.defaultLocale;
    }

    const messages = (await import(`./messages/${locale}.json`)).default;

    return {
        locale,
        messages: applyBrand(messages),
        onError: reportMessageError,
        getMessageFallback({ key }) {
            return humanizeMessageKey(key);
        },
    };
});
