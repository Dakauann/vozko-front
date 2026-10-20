import { describe, expect, it } from "vitest";

import { applyBrand, type BrandMessageValues } from "./apply-brand";

const ACME: BrandMessageValues = {
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

describe("applyBrand", () => {
  it("fills the brand name and its article phrases for the catalog locale", () => {
    const messages = { welcome: "Bem-vindo {toBrand}", lead: "{TheBrand} cuida disso", plain: "Conta {brandName}" };
    expect(applyBrand(messages, ACME, "pt")).toEqual({
      welcome: "Bem-vindo à Acme",
      lead: "A Acme cuida disso",
      plain: "Conta Acme",
    });
  });

  it("follows a masculine brand without touching the catalog", () => {
    const messages = { welcome: "Bem-vindo {toBrand}", spanish: "{TheBrand}" };
    expect(applyBrand(messages, { ...ACME, gender: "masculine" }, "pt").welcome).toBe("Bem-vindo ao Acme");
    expect(applyBrand(messages, { ...ACME, gender: "masculine" }, "es").spanish).toBe("El Acme");
  });

  it("keeps brand values that need JSON escaping intact", () => {
    const messages = { quote: "{ofBrand}" };
    expect(applyBrand(messages, { ...ACME, name: 'Acme "Pro"' }, "pt").quote).toBe('da Acme "Pro"');
  });
});
