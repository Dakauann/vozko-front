// White-label brand identity for the frontend.
//
// The codebase ships NO brand: every value is provided at build time via
// NEXT_PUBLIC_BRAND_* environment variables (Next.js inlines these at build, so
// each brand is its own build). There is no default. If a required variable is
// missing, getBrand() throws, so an unbranded build fails loudly rather than
// shipping placeholder identity. Assets are CDN URLs (no brand images in repo).

export interface Brand {
  key: string;
  name: string;
  legalName: string;
  cnpj: string;
  siteUrl: string;
  docsUrl?: string;
  supportEmail: string;
  contactEmail: string;
  dpoEmail: string;
  phone: string;
  aiName: string;
  aiAliasPrefix: string;
  logo: {
    mark: string;
    markWhite: string;
    favicon: string;
  };
}

// NEXT_PUBLIC_* must be referenced as full static member expressions (not via a
// computed key) so Next.js can inline them at build time.
const RAW = {
  key: process.env.NEXT_PUBLIC_BRAND_KEY ?? "",
  name: process.env.NEXT_PUBLIC_BRAND_NAME,
  legalName: process.env.NEXT_PUBLIC_BRAND_LEGAL_NAME,
  cnpj: process.env.NEXT_PUBLIC_BRAND_CNPJ,
  siteUrl: process.env.NEXT_PUBLIC_BRAND_SITE_URL,
  docsUrl: process.env.NEXT_PUBLIC_BRAND_DOCS_URL,
  supportEmail: process.env.NEXT_PUBLIC_BRAND_SUPPORT_EMAIL,
  contactEmail: process.env.NEXT_PUBLIC_BRAND_CONTACT_EMAIL,
  dpoEmail: process.env.NEXT_PUBLIC_BRAND_DPO_EMAIL,
  phone: process.env.NEXT_PUBLIC_BRAND_PHONE,
  aiName: process.env.NEXT_PUBLIC_BRAND_AI_NAME,
  aiAliasPrefix: process.env.NEXT_PUBLIC_BRAND_AI_ALIAS_PREFIX,
  logoMark: process.env.NEXT_PUBLIC_BRAND_LOGO_URL,
  logoMarkWhite: process.env.NEXT_PUBLIC_BRAND_LOGO_WHITE_URL,
  favicon: process.env.NEXT_PUBLIC_BRAND_FAVICON_URL,
} as const;

let cached: Brand | null = null;

/**
 * Resolve the active brand from NEXT_PUBLIC_BRAND_* env vars. Throws (listing
 * every missing var) if the build was not given a complete brand. Memoized.
 */
export function getBrand(): Brand {
  if (cached) return cached;

  const required: Record<string, string | undefined> = {
    NEXT_PUBLIC_BRAND_NAME: RAW.name,
    NEXT_PUBLIC_BRAND_LEGAL_NAME: RAW.legalName,
    NEXT_PUBLIC_BRAND_CNPJ: RAW.cnpj,
    NEXT_PUBLIC_BRAND_SITE_URL: RAW.siteUrl,
    NEXT_PUBLIC_BRAND_SUPPORT_EMAIL: RAW.supportEmail,
    NEXT_PUBLIC_BRAND_CONTACT_EMAIL: RAW.contactEmail,
    NEXT_PUBLIC_BRAND_DPO_EMAIL: RAW.dpoEmail,
    NEXT_PUBLIC_BRAND_PHONE: RAW.phone,
    NEXT_PUBLIC_BRAND_AI_NAME: RAW.aiName,
    NEXT_PUBLIC_BRAND_AI_ALIAS_PREFIX: RAW.aiAliasPrefix,
    NEXT_PUBLIC_BRAND_LOGO_URL: RAW.logoMark,
    NEXT_PUBLIC_BRAND_LOGO_WHITE_URL: RAW.logoMarkWhite,
    NEXT_PUBLIC_BRAND_FAVICON_URL: RAW.favicon,
  };

  const missing = Object.entries(required)
    .filter(([, v]) => !v || v.trim() === "")
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(
      `Brand config missing required env var(s): ${missing.join(", ")}. ` +
        "The codebase ships no default brand; set all NEXT_PUBLIC_BRAND_* at build time.",
    );
  }

  cached = {
    key: RAW.key,
    name: RAW.name!,
    legalName: RAW.legalName!,
    cnpj: RAW.cnpj!,
    siteUrl: RAW.siteUrl!,
    docsUrl: RAW.docsUrl?.trim() || undefined,
    supportEmail: RAW.supportEmail!,
    contactEmail: RAW.contactEmail!,
    dpoEmail: RAW.dpoEmail!,
    phone: RAW.phone!,
    aiName: RAW.aiName!,
    aiAliasPrefix: RAW.aiAliasPrefix!,
    logo: {
      mark: RAW.logoMark!,
      markWhite: RAW.logoMarkWhite!,
      favicon: RAW.favicon!,
    },
  };
  return cached;
}
