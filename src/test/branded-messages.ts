import { applyBrand, type BrandMessageValues } from "@/i18n/apply-brand";

export const TEST_BRAND: BrandMessageValues = {
  name: "Acme",
  legalName: "Acme Comercio LTDA",
  cnpj: "11.222.333/0001-44",
  supportEmail: "ajuda@acme.example",
  contactEmail: "contato@acme.example",
  dpoEmail: "dpo@acme.example",
  phone: "+00 00 0000-0000",
  siteUrl: "https://acme.example",
  aiName: "Acme AI",
  gender: "feminine",
};

export function brandedMessages<T>(messages: T, locale = "pt"): T {
  return applyBrand(messages, TEST_BRAND, locale);
}
