import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

import { WORKFLOW_ERROR_CODES } from "./error-codes";
import { TRIGGER_INPUT_ISSUE_CODES } from "./trigger-input";

const CATALOGS: Record<string, unknown> = { pt, en, es, de };
const TRIGGER_REFUSAL_CODES = ["no_recent_input", "test_input_invalid", "trigger_input_invalid", "trigger_input_unavailable", "trigger_not_found"];

function triggerInputCopyOf(messages: unknown): Record<string, unknown> {
  const debug = (messages as Record<string, Record<string, Record<string, unknown>> | undefined>).workflowDebug;
  return (debug?.triggerInput ?? {}) as Record<string, unknown>;
}

function issuesOf(messages: unknown): Record<string, unknown> {
  return (triggerInputCopyOf(messages).issues ?? {}) as Record<string, unknown>;
}

describe("trigger input codes", () => {
  it("lists the issue codes once and sorted", () => {
    expect([...TRIGGER_INPUT_ISSUE_CODES].sort()).toEqual([...TRIGGER_INPUT_ISSUE_CODES]);
    expect(new Set(TRIGGER_INPUT_ISSUE_CODES).size).toBe(TRIGGER_INPUT_ISSUE_CODES.length);
  });

  it.each(Object.keys(CATALOGS))("translates every issue code in %s", (locale) => {
    const copy = issuesOf(CATALOGS[locale]);
    const missing = TRIGGER_INPUT_ISSUE_CODES.filter((code) => typeof copy[code] !== "string" || !(copy[code] as string).trim());
    expect(missing).toEqual([]);
  });

  it.each(Object.keys(CATALOGS))("keeps no issue copy in %s for a code the backend does not send", (locale) => {
    const stale = Object.keys(issuesOf(CATALOGS[locale])).filter((code) => !(TRIGGER_INPUT_ISSUE_CODES as readonly string[]).includes(code));
    expect(stale).toEqual([]);
  });

  it("keeps the trigger refusal codes in the workflow error catalog, their one home", () => {
    const codes: readonly string[] = WORKFLOW_ERROR_CODES.workflowsPage;
    expect(TRIGGER_REFUSAL_CODES.filter((code) => !codes.includes(code))).toEqual([]);
  });

  it.each(Object.keys(CATALOGS))("keeps no second copy of the refusal codes under the trigger input copy in %s", (locale) => {
    expect(triggerInputCopyOf(CATALOGS[locale]).errors).toBeUndefined();
  });
});
