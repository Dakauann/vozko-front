import { afterEach, describe, expect, it, vi } from "vitest";

const COMPLETE_BRAND_ENV: Record<string, string> = {
  NEXT_PUBLIC_BRAND_KEY: "acme",
  NEXT_PUBLIC_BRAND_NAME: "Acme",
  NEXT_PUBLIC_BRAND_LEGAL_NAME: "ACME LTDA",
  NEXT_PUBLIC_BRAND_CNPJ: "00.000.000/0001-00",
  NEXT_PUBLIC_BRAND_SITE_URL: "https://acme.example",
  NEXT_PUBLIC_BRAND_SUPPORT_EMAIL: "suporte@acme.example",
  NEXT_PUBLIC_BRAND_CONTACT_EMAIL: "contato@acme.example",
  NEXT_PUBLIC_BRAND_DPO_EMAIL: "dpo@acme.example",
  NEXT_PUBLIC_BRAND_PHONE: "+00 00 0000-0000",
  NEXT_PUBLIC_BRAND_AI_NAME: "Acme AI",
  NEXT_PUBLIC_BRAND_AI_ALIAS_PREFIX: "acme_",
  NEXT_PUBLIC_BRAND_LOGO_URL: "https://cdn.acme.example/logo.png",
  NEXT_PUBLIC_BRAND_LOGO_WHITE_URL: "https://cdn.acme.example/logo-white.png",
  NEXT_PUBLIC_BRAND_FAVICON_URL: "https://cdn.acme.example/favicon.ico",
  NEXT_PUBLIC_BRAND_GENDER: "feminine",
};

async function loadBrandWith(overrides: Record<string, string>) {
  for (const [key, value] of Object.entries({ ...COMPLETE_BRAND_ENV, ...overrides })) {
    vi.stubEnv(key, value);
  }
  vi.resetModules();
  const { getBrand } = await import("./brand");
  return getBrand;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getBrand gender", () => {
  it("reads the configured grammatical gender", async () => {
    const getBrand = await loadBrandWith({ NEXT_PUBLIC_BRAND_GENDER: "masculine" });
    expect(getBrand().gender).toBe("masculine");
  });

  it("refuses to build without a gender, like every other brand field", async () => {
    const getBrand = await loadBrandWith({ NEXT_PUBLIC_BRAND_GENDER: "" });
    expect(() => getBrand()).toThrow(/NEXT_PUBLIC_BRAND_GENDER/);
  });

  it("refuses a gender it does not know instead of picking one", async () => {
    const getBrand = await loadBrandWith({ NEXT_PUBLIC_BRAND_GENDER: "neutral" });
    expect(() => getBrand()).toThrow(/NEXT_PUBLIC_BRAND_GENDER/);
  });
});
