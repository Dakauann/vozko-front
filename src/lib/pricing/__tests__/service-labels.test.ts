import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

const CATALOGS = { pt, en, de, es } as const;

type Catalog = (typeof CATALOGS)[keyof typeof CATALOGS];
type Labels = Record<string, unknown>;

const BACKEND_CATALOG = [
  { category: "whatsapp", service: "utility", metric: "per_message" },
  { category: "whatsapp", service: "marketing", metric: "per_message" },
  { category: "whatsapp", service: "authentication", metric: "per_message" },
  { category: "whatsapp", service: "service", metric: "per_message" },
  { category: "telephony", service: "whatsapp_calls", metric: "per_minute" },
  { category: "telephony", service: "sip_calls", metric: "per_minute" },
  { category: "llm", service: "default_markup", metric: "percentage" },
  { category: "advertising", service: "published_ad", metric: "per_ad" },
  { category: "email", service: "send", metric: "per_message" },
  { category: "rcs", service: "basic", metric: "per_message" },
  { category: "rcs", service: "single", metric: "per_message" },
  { category: "rcs", service: "conversation", metric: "per_conversation" },
  { category: "rcs", service: "inbound", metric: "per_message" },
  { category: "sms", service: "segment", metric: "per_segment" },
  { category: "sms", service: "inbound", metric: "per_message" },
] as const;

const NAMESPACES: Record<string, { labels: (c: Catalog) => Labels; skips: readonly string[] }> = {
  adminPlans: { labels: (c) => c.adminPlans.pricing, skips: [] },
  plansPage: { labels: (c) => c.plansPage.pricing, skips: [] },
  adminPricing: { labels: (c) => c.adminPricing, skips: ["llm"] },
};

function label(labels: Labels, path: string[]): unknown {
  return path.reduce<unknown>((node, key) => (node as Labels | undefined)?.[key], labels);
}

describe("pricing labels", () => {
  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    for (const [namespace, { labels, skips }] of Object.entries(NAMESPACES)) {
      it(`${locale}.${namespace} names every category, service and metric the backend prices`, () => {
        const root = labels(catalog);
        for (const item of BACKEND_CATALOG.filter((entry) => !skips.includes(entry.category))) {
          for (const path of [
            ["categories", item.category],
            ["services", item.category, item.service],
            ["metrics", item.metric],
          ]) {
            const value = label(root, path);
            expect(typeof value === "string" && value.trim() !== "", `${locale}.${namespace}.${path.join(".")} is missing`).toBe(true);
          }
        }
      });
    }
  }
});
