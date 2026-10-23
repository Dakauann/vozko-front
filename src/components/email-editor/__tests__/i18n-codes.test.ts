import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { FONT_FAMILIES } from "@/lib/email-design/limits";
import { BLOCK_KINDS, COLUMN_RATIOS, SOCIAL_NETWORKS } from "@/lib/email-design/types";
import { flattenCatalog } from "@/test/message-catalog";

import { SHORTCUTS } from "../keyboard-help";
import { BACKEND_HINT_CODES, BACKEND_ISSUE_CODES, BACKEND_STARTER_KEYS } from "./backend-codes";

const CATALOGS = { pt, en, es, de };

const REQUIRED = [
  ...BACKEND_ISSUE_CODES.map((code) => `emailEditor.issues.${code}`),
  ...BACKEND_HINT_CODES.map((code) => `emailEditor.hints.${code}`),
  ...BACKEND_STARTER_KEYS.map((key) => `emailEditor.starters.${key}`),
  ...BLOCK_KINDS.flatMap((kind) => [`emailEditor.palette.kinds.${kind}.label`, `emailEditor.palette.kinds.${kind}.description`]),
  ...SOCIAL_NETWORKS.map((network) => `emailEditor.social.networks.${network}`),
  ...COLUMN_RATIOS.map((ratio) => `emailEditor.inspector.ratios.${ratio}`),
  ...FONT_FAMILIES.map((font) => `emailEditor.inspector.fonts.${font}`),
  ...SHORTCUTS.map((shortcut) => `emailEditor.keyboard.${shortcut.id}`),
];

describe("emailEditor catalog", () => {
  it.each(Object.entries(CATALOGS))("translates every backend code and editor key in %s", (_, catalog) => {
    const flat = flattenCatalog(catalog);
    const missing = REQUIRED.filter((key) => {
      const value = flat.get(key);
      return typeof value !== "string" || value.trim() === "";
    });
    expect(missing).toEqual([]);
  });

  it.each(Object.entries(CATALOGS))("has no en or em dashes and no hardcoded brand in %s", (_, catalog) => {
    const flat = flattenCatalog(catalog);
    const offending = [...flat.entries()].filter(([key, value]) => key.startsWith("emailEditor.") && typeof value === "string" && (/[\u2013\u2014]/.test(value) || /vozko/i.test(value)));
    expect(offending).toEqual([]);
  });
});
