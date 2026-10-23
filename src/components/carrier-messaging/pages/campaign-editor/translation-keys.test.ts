import { readdirSync, readFileSync } from "fs";
import { join, relative, sep } from "path";
import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { flattenCatalog } from "@/test/message-catalog";
import { literalTranslationUsages } from "@/test/translation-usages";

const ROOT = join(__dirname, "..");
const SCANNED = [join(ROOT, "campaigns-list"), join(ROOT, "campaign-editor")];
const LEAVES = new Set(flattenCatalog(pt).keys());

const DYNAMIC_KEYS = [
  ...["rcs", "sms"].map((channel) => `carrierMessaging.pages.campaignEditor.channel.channelHints.${channel}`),
  ...["marketing", "transactional"].map((kind) => `carrierMessaging.pages.campaignEditor.channel.kindHints.${kind}`),
  ...["active", "paused"].map((status) => `carrierMessaging.pages.campaignEditor.sender.routeStatus.${status}`),
  ...["channel", "message", "fallback", "audience", "review", "send"].flatMap((step) =>
    ["title", "description", "caption"].map((field) => `carrierMessaging.pages.campaignEditor.steps.${step}.${field}`),
  ),
  ...["ids", "all_matching", "first_n", "everyone"].map((mode) => `carrierMessaging.pages.campaignEditor.audience.modes.${mode}`),
  ...["once", "recurring"].flatMap((mode) => [`carrierMessaging.pages.campaignEditor.schedule.modes.${mode}`, `carrierMessaging.pages.campaignEditor.schedule.modeHints.${mode}`]),
  ...["daily", "weekly", "monthly"].map((frequency) => `carrierMessaging.pages.campaignEditor.schedule.frequencies.${frequency}`),
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .map((file) => join(dir, file));
}

describe("campaign list and editor translation keys", () => {
  const usages = SCANNED.flatMap(sourceFiles).flatMap((file) =>
    literalTranslationUsages(readFileSync(file, "utf8")).map((usage) => ({ ...usage, where: `${relative(ROOT, file).split(sep).join("/")}:${usage.line}` })),
  );

  it("finds the literal keys the components use", () => {
    expect(usages.length).toBeGreaterThan(120);
  });

  it("has every literal key in pt.json", () => {
    expect(usages.filter((usage) => !LEAVES.has(usage.key)).map((usage) => `${usage.where} ${usage.key}`)).toEqual([]);
  });

  for (const [locale, catalog] of Object.entries({ pt, en, es, de })) {
    it(`has every dynamic key in ${locale}`, () => {
      const leaves = new Set(flattenCatalog(catalog).keys());
      expect(DYNAMIC_KEYS.filter((key) => !leaves.has(key))).toEqual([]);
    });
  }
});
