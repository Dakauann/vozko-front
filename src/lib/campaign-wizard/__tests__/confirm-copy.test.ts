import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

type Translate = (key: string, values: Record<string, string | number>) => string;

function translator(locale: string, messages: unknown): Translate {
  return createTranslator({ locale, messages } as never) as unknown as Translate;
}

const CATALOGS = { pt, en, es, de } as const;

const COUNTED: { key: string; values: Record<string, string> }[] = [
  { key: "whatsappCampaignsPage.wizard.confirm.nowBody", values: { total: "R$ 1,00" } },
  { key: "whatsappCampaignsPage.wizard.summary.recipientsValue", values: {} },
  { key: "emailCampaigns.send.confirm.nowBody", values: { total: "R$ 1,00", unit: "R$ 0,01", first: "R$ 1,00" } },
  { key: "emailCampaigns.send.summary.recipientsValue", values: {} },
];

describe("campaign start copy", () => {
  it("agrees the noun with the count in Portuguese", () => {
    const t = translator("pt", pt);
    expect(t("whatsappCampaignsPage.wizard.confirm.nowBody", { count: 1, total: "R$ 0,0035" })).toBe("A campanha vai para 1 contato, com custo estimado de R$ 0,0035.");
    expect(t("whatsappCampaignsPage.wizard.confirm.nowBody", { count: 1200, total: "R$ 4,20" })).toBe("A campanha vai para 1.200 contatos, com custo estimado de R$ 4,20.");
    expect(t("whatsappCampaignsPage.wizard.summary.recipientsValue", { count: 1 })).toBe("1 pronto para envio");
    expect(t("emailCampaigns.send.summary.recipientsValue", { count: 3 })).toBe("3 prontos para envio");
    expect(t("emailCampaigns.send.confirm.nowBody", { count: 1, total: "R$ 0,01", unit: "R$ 0,01", first: "R$ 0,01" })).toContain("(1 e-mail a R$ 0,01 cada)");
  });

  it("formats every counted message as a plural in all four locales", () => {
    for (const [locale, messages] of Object.entries(CATALOGS)) {
      const t = translator(locale, messages);
      for (const { key, values } of COUNTED) {
        const one = t(key, { ...values, count: 1 });
        const many = t(key, { ...values, count: 2 });
        expect(one, `${locale} ${key}`).toMatch(/\b1\b/);
        expect(many, `${locale} ${key}`).toMatch(/\b2\b/);
        expect(one, `${locale} ${key}`).not.toContain("{count");
      }
    }
  });
});
