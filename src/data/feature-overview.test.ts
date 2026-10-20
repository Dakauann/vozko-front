import { describe, expect, it } from "vitest";

import deMessages from "@/i18n/messages/de.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import ptMessages from "@/i18n/messages/pt.json";

import { featureConfigs } from "./feature-overview";

const catalogs = { pt: ptMessages, en: enMessages, es: esMessages, de: deMessages };

describe("feature overview pages", () => {
  it.each(Object.entries(catalogs))("lists exactly the features the %s catalog describes, so no line goes missing", (_locale, messages) => {
    const pages = messages.featurePages as Record<string, { features?: string[] }>;
    for (const [key, config] of Object.entries(featureConfigs)) {
      expect(pages[key]?.features?.length, key).toBe(config.features.length);
      config.features.forEach((feature, index) => expect(feature.textKey, key).toBe(`${key}.features.${index}`));
    }
  });
});
