import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { CAMPAIGN_AUDIENCE_ERROR_CODES } from "@/lib/campaign-audience/errors";
import { SKIP_REASONS } from "@/lib/email-campaigns/types";

const CATALOGS: Record<string, { campaignAudience: { errors: Record<string, string> }; emailCampaigns: { skip: Record<string, string> } }> = { pt, en, es, de };
const DASHES = new RegExp("[–—]");

type Messages = { [key: string]: string | Messages };

const AUDIENCE_NAMESPACES = ["campaignAudience", "campaignContactList", "whatsappTemplates.form.editor.body", "emailCampaigns.review.mergeTags"];

function subtree(catalog: Messages, namespace: string): Messages {
  return namespace.split(".").reduce((node, key) => node[key] as Messages, catalog);
}

function messagesOf(tree: Messages, path: string): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) => (typeof value === "string" ? [[`${path}.${key}`, value] as [string, string]] : messagesOf(value, `${path}.${key}`)));
}

describe("campaign audience error catalog", () => {
  it.each(Object.keys(CATALOGS))("translates every backend code in %s", (locale) => {
    const errors = CATALOGS[locale].campaignAudience.errors;
    for (const code of CAMPAIGN_AUDIENCE_ERROR_CODES) {
      expect(errors[code], `${locale} campaignAudience.errors.${code}`).toBeTruthy();
      expect(DASHES.test(errors[code])).toBe(false);
    }
    expect(Object.keys(errors).sort()).toEqual([...CAMPAIGN_AUDIENCE_ERROR_CODES].sort());
  });

  it.each(Object.keys(CATALOGS))("names every email skip reason in %s", (locale) => {
    for (const reason of SKIP_REASONS) {
      expect(CATALOGS[locale].emailCampaigns.skip[reason], `${locale} emailCampaigns.skip.${reason}`).toBeTruthy();
    }
  });

  it.each(Object.keys(CATALOGS))("writes every audience message as valid ICU in %s, so no raw key ever renders", (locale) => {
    const catalog = CATALOGS[locale] as unknown as Messages;
    for (const [path, message] of AUDIENCE_NAMESPACES.flatMap((namespace) => messagesOf(subtree(catalog, namespace), namespace))) {
      expect(() => new IntlMessageFormat(message, locale), `${locale} ${path}`).not.toThrow();
    }
  });
});
