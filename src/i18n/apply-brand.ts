import { brandPhraseTokens, type BrandGender } from "@/lib/branding/brand-phrases";

export interface BrandMessageValues {
  name: string;
  legalName: string;
  cnpj: string;
  supportEmail: string;
  contactEmail: string;
  dpoEmail: string;
  phone: string;
  siteUrl: string;
  aiName: string;
  gender: BrandGender;
}

function brandTokens(brand: BrandMessageValues, locale: string): Record<string, string> {
  return {
    "{brandName}": brand.name,
    "{brandLegalName}": brand.legalName,
    "{brandCnpj}": brand.cnpj,
    "{brandSupportEmail}": brand.supportEmail,
    "{brandContactEmail}": brand.contactEmail,
    "{brandDpoEmail}": brand.dpoEmail,
    "{brandPhone}": brand.phone,
    "{brandSiteUrl}": brand.siteUrl,
    "{brandAiName}": brand.aiName,
    ...brandPhraseTokens(brand.name, brand.gender, locale),
  };
}

export function applyBrand<T>(messages: T, brand: BrandMessageValues, locale: string): T {
  let json = JSON.stringify(messages);
  for (const [token, value] of Object.entries(brandTokens(brand, locale))) {
    const escaped = JSON.stringify(value).slice(1, -1);
    json = json.split(token).join(escaped);
  }
  return JSON.parse(json) as T;
}
