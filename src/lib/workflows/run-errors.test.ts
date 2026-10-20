import { describe, expect, it } from "vitest";

import deMessages from "@/i18n/messages/de.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import ptMessages from "@/i18n/messages/pt.json";
import { flattenCatalog } from "@/test/message-catalog";

import { ACCESS_REFUSAL_KEYS, accessRefusalOf, RUN_ERROR_REASON_KEYS, runErrorReasonKey } from "./run-errors";

describe("accessRefusalOf", () => {
  it("tells a workflow the viewer cannot reach apart from one that does not exist", () => {
    expect(accessRefusalOf(403)).toBe("forbidden");
    expect(accessRefusalOf(404)).toBe("not_found");
  });

  it("leaves every other failure to the caller's own message", () => {
    expect(accessRefusalOf(500)).toBeNull();
    expect(accessRefusalOf(409)).toBeNull();
    expect(accessRefusalOf(undefined)).toBeNull();
  });
});

describe("runErrorReasonKey", () => {
  it("names the engine's cancel reasons instead of showing their codes", () => {
    expect(runErrorReasonKey("cancelled_by_operator")).toBe("cancelledByOperator");
    expect(runErrorReasonKey("conversation_finished")).toBe("conversationFinished");
  });

  it("keeps any other error text as written", () => {
    expect(runErrorReasonKey("HTTP 500 from api")).toBeNull();
    expect(runErrorReasonKey(undefined)).toBeNull();
    expect(runErrorReasonKey("toString")).toBeNull();
  });

  it("has copy for every refusal and reason in the four catalogs", () => {
    for (const messages of [ptMessages, enMessages, esMessages, deMessages]) {
      const flat = flattenCatalog(messages);
      for (const key of Object.values(ACCESS_REFUSAL_KEYS)) expect(flat.get(`workflowRuns.refusal.${key}`)).toBeTruthy();
      for (const key of Object.values(RUN_ERROR_REASON_KEYS)) expect(flat.get(`workflowRuns.errorReasons.${key}`)).toBeTruthy();
    }
  });
});
