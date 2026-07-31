import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { getBrand } from '@/config/brand';

// Brand tokens embedded in the message catalogs. The catalogs ship with these
// placeholders instead of a hardcoded brand; they are substituted here with the
// active brand's values (build-time env). Only these exact tokens are replaced,
// so real ICU variables ({year}, {count}, {name}, ...) are left untouched.
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
        // JSON-escape the value so it is safe inside the stringified catalog.
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
        onError(error) {
            // Missing/invalid messages must never crash a page; log outside prod.
            if (process.env.NODE_ENV !== 'production') {
                console.error(error);
            }
        },
        getMessageFallback({ key }) {
            // Never render dotted key paths in the UI: fall back to a humanized
            // last segment (e.g. "sidebar.families.campaigns" -> "Campaigns").
            const last = key.split('.').pop() ?? key;
            const spaced = last.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
            return spaced.charAt(0).toUpperCase() + spaced.slice(1);
        },
    };
});
