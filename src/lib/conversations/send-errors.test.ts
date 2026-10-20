import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import deMessages from "@/i18n/messages/de.json";

import { SEND_ERROR_KEYS, sendErrorKey } from "./send-errors";

describe("send error copy", () => {
  const cases: { code: string | undefined; key: string }[] = [
    { code: "send_failed", key: "sendFailed" },
    { code: "unauthorized", key: "unauthorized" },
    { code: "not_configured", key: "notConfigured" },
    { code: "internal_error", key: "internalError" },
    { code: "not_allowed", key: "notAllowed" },
    { code: "not_found", key: "notFound" },
    { code: "window_expired", key: "windowExpired" },
    { code: "unsupported", key: "unsupported" },
    { code: "failed", key: "sendFailed" },
    { code: "something_new", key: "generic" },
    { code: "", key: "generic" },
    { code: undefined, key: "generic" },
  ];

  for (const c of cases) {
    it(`explains ${c.code || "a missing code"} with the ${c.key} copy`, () => {
      expect(sendErrorKey(c.code)).toBe(c.key);
    });
  }

  it("has copy for every reason in all four languages, so no operator sees a raw server message", () => {
    for (const messages of [ptMessages, enMessages, esMessages, deMessages]) {
      for (const key of SEND_ERROR_KEYS) {
        expect(messages.crmConversation.sendError[key]).toBeTruthy();
      }
    }
  });
});
