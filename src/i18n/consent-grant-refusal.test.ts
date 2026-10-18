import { describe, expect, it } from "vitest";

import { codedErrorMessage, type CodedTranslator } from "@/lib/api/coded-error";
import { importErrorMessage } from "@/components/leads/imports/import-messages";

import de from "./messages/de.json";
import en from "./messages/en.json";
import es from "./messages/es.json";
import pt from "./messages/pt.json";

const locales = { pt, en, es, de } as Record<string, unknown>;

const CODE = "lead_consent_grant_forbidden";
const FALLBACK = "fallback";

function lookup(messages: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (node, segment) => (node && typeof node === "object" ? (node as Record<string, unknown>)[segment] : undefined),
    messages,
  );
}

function translatorAt(messages: unknown, namespace: string): CodedTranslator {
  const scope = lookup(messages, namespace);
  const t = (key: string) => {
    const value = lookup(scope, key);
    return typeof value === "string" ? value : `${namespace}.${key}`;
  };
  return Object.assign(t, { has: (key: string) => typeof lookup(scope, key) === "string" });
}

const refusal = { status: 403, code: CODE, expected: { permission: "leads:consent" } };

describe("the consent grant refusal", () => {
  it.each(Object.keys(locales))("is explained on workflow and lead saves in %s", (locale) => {
    for (const namespace of ["workflowsPage", "leads"]) {
      const message = codedErrorMessage(translatorAt(locales[locale], namespace), refusal, FALLBACK);
      expect(message, `${locale}: ${namespace}`).not.toBe(FALLBACK);
      expect(message.trim(), `${locale}: ${namespace}`).not.toBe("");
    }
  });

  it.each(Object.keys(locales))("is explained on agent saves in %s", (locale) => {
    const value = lookup(locales[locale], `agents.form.toast.errorCodes.${CODE}`);
    expect(typeof value).toBe("string");
    expect((value as string).trim()).not.toBe("");
  });

  it.each(Object.keys(locales))("is explained on lead imports in %s", (locale) => {
    const t = translatorAt(locales[locale], "leadsPage.import");
    const message = importErrorMessage(t, refusal, { headers: [], fields: [], formatNumber: String, limits: null });
    expect(message).toBe(lookup(locales[locale], `leadsPage.import.errors.${CODE}`));
    expect(message).not.toBe(t("generic"));
  });
});
