import { describe, expect, it } from "vitest";

import { isAutomationActive, resolveAutomationEnabled } from "./automation";

/**
 * The shipped bug, end to end: the operator pauses a Telegram conversation, the
 * PATCH returns 200, the row in telegram_conversations reads false, the
 * `conversation:subscribed` frame reports false, and the header still says the
 * agent is answering, because the handler resolved the value from the cached
 * inbox entry instead of from the frame.
 */

describe("resolveAutomationEnabled", () => {
  it("prefers the server frame over the inbox cache", () => {
    expect(resolveAutomationEnabled(false, true, true)).toBe(false);
  });

  // The exact shape of the bug. Telegram and Instagram conversations are absent
  // from a campaign-scoped inbox cache, so the cache answers undefined; the
  // frame is the only source that knows.
  it("uses the frame when the conversation is not in the inbox cache", () => {
    expect(resolveAutomationEnabled(false, undefined, undefined)).toBe(false);
  });

  it("falls back to the cache for frames that omit the field", () => {
    expect(resolveAutomationEnabled(undefined, false, true)).toBe(false);
  });

  it("falls back to the previous value when neither source answers", () => {
    expect(resolveAutomationEnabled(undefined, undefined, false)).toBe(false);
  });

  // `||` here would turn a just-set false back into the fallback, which is the
  // one value an operator actually chose.
  it("does not let a false be swallowed by a truthy fallback", () => {
    expect(resolveAutomationEnabled(false, true, true)).not.toBe(true);
    expect(resolveAutomationEnabled(undefined, false, true)).not.toBe(true);
  });

  it("reports null when nothing knows, meaning inherit", () => {
    expect(resolveAutomationEnabled(undefined, undefined, undefined)).toBeNull();
  });

  it("keeps an explicit true distinguishable from inherit", () => {
    expect(resolveAutomationEnabled(true, undefined, undefined)).toBe(true);
  });
});

describe("isAutomationActive", () => {
  it("treats only an explicit false as paused", () => {
    expect(isAutomationActive(false)).toBe(false);
  });

  it("treats inherit as active, since the account switch decides", () => {
    expect(isAutomationActive(null)).toBe(true);
    expect(isAutomationActive(undefined)).toBe(true);
  });

  it("treats an explicit true as active", () => {
    expect(isAutomationActive(true)).toBe(true);
  });
});
