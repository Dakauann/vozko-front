import { describe, expect, it } from "vitest";

import IntlMessageFormat from "intl-messageformat";
import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

const CATALOGS: Record<string, Record<string, unknown>> = { pt, en, de, es };

const DASHES = new RegExp("[\\u2013\\u2014]");

const BACKEND_RESOURCES = [
  "agents", "whatsapp_campaigns", "whatsapp_templates", "business_phones", "stages", "stage_groups",
  "labels", "balance", "conversations", "media", "leads", "call_recordings", "members", "assignments",
  "attendance", "attendance_targets", "reports", "knowledge_bases", "roles", "issues", "workflows",
  "calendar", "departments", "message_shortcuts", "call_session", "mcp", "plans", "ai_chat",
  "short_links", "instagram_accounts", "facebook_pages", "audience", "telegram_accounts",
  "webchat_widgets", "unofficial_whatsapp_instances", "unofficial_whatsapp_campaigns", "sip_trunks",
  "call_queues", "call_history", "ads",
];

const PRESET_KEYS = ["operator", "supervisor", "manager", "sales", "analyst", "marketing", "automation", "finance"];

const BUILDER_KEYS = [
  "galleryTitle", "blankTitle", "blankDescription", "permissionCount", "presetsUnavailable", "summaryTitle",
  "summaryEmpty", "adjustPermissions", "basedOn", "changes", "restorePreset", "matchesPreset", "linkedTo",
  "applyPreset", "linkOption", "linkOptionDescription", "copyOption", "copyOptionDescription", "linkedNotice",
  "unlinkToEdit", "nameHint", "zeroPermissionsHint", "confirmReplaceTitle", "confirmReplaceDescription",
  "confirmBlankDescription", "confirmReplace", "errors.nameTaken", "errors.roleLinked", "errors.unknownPreset",
];

function lookup(catalog: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined),
    catalog,
  );
}

describe("role messages", () => {
  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`${locale} labels and describes every backend resource`, () => {
      for (const resource of BACKEND_RESOURCES) {
        expect(typeof lookup(catalog, `workspaceSettings.resources.${resource}`), resource).toBe("string");
        expect(typeof lookup(catalog, `workspaceSettings.resourceDescriptions.${resource}`), resource).toBe("string");
      }
    });

    it(`${locale} carries the role builder copy and every preset`, () => {
      for (const key of BUILDER_KEYS) {
        const value = lookup(catalog, `roleBuilder.${key}`);
        expect(typeof value, key).toBe("string");
        expect(() => new IntlMessageFormat(value as string, locale)).not.toThrow();
      }
      for (const preset of PRESET_KEYS) {
        for (const field of ["name", "description", "highlights.0", "highlights.1", "highlights.2"]) {
          expect(typeof lookup(catalog, `roleBuilder.presets.${preset}.${field}`), `${preset}.${field}`).toBe("string");
        }
      }
    });

    it(`${locale} role builder copy has no em or en dashes`, () => {
      expect(DASHES.test(JSON.stringify(lookup(catalog, "roleBuilder")))).toBe(false);
    });
  }
});
