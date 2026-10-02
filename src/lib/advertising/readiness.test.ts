import { describe, expect, it } from "vitest";

import { accountIsReady, blockingItems, itemAction, readinessKey, readinessState } from "./readiness";

describe("accountIsReady", () => {
  it("is ready only when the server says so and nothing blocks", () => {
    expect(accountIsReady({ ready: true, blocking: [] })).toBe(true);
    expect(accountIsReady({ ready: true, blocking: ["page"] })).toBe(false);
    expect(accountIsReady({ ready: false, blocking: [] })).toBe(false);
    expect(accountIsReady(null)).toBe(false);
    expect(accountIsReady(undefined)).toBe(false);
  });
});

describe("readiness keys and states", () => {
  it("never reads an unexpected state as ready", () => {
    expect(readinessState("ready")).toBe("ready");
    expect(readinessState("missing")).toBe("missing");
    expect(readinessState("READY")).toBe("unknown");
    expect(readinessState("")).toBe("unknown");
  });

  it("knows only the checklist keys", () => {
    expect(readinessKey("payment_method")).toBe("payment_method");
    expect(readinessKey("something_new")).toBeNull();
  });
});

describe("blockingItems", () => {
  it("keeps the items the server lists as blocking, in checklist order", () => {
    const items = [
      { key: "payment_method", state: "missing", required: true },
      { key: "page", state: "unknown", required: true },
      { key: "pixel", state: "missing", required: false },
    ];
    expect(blockingItems({ blocking: ["page", "payment_method"], items }).map((item) => item.key)).toEqual(["payment_method", "page"]);
  });
});

describe("itemAction", () => {
  it("accepts the known in-app actions", () => {
    expect(itemAction({ action: { kind: "in_app", key: "create_pixel" } })).toEqual({ kind: "inApp", key: "create_pixel" });
    expect(itemAction({ action: { kind: "in_app", key: "format_disk" } })).toBeNull();
  });

  it("opens only https pages on Meta", () => {
    expect(itemAction({ action: { kind: "portal", url: "https://business.facebook.com/latest/billing_hub" } })).toEqual({
      kind: "portal",
      url: "https://business.facebook.com/latest/billing_hub",
    });
    expect(itemAction({ action: { kind: "portal", url: "https://www.facebook.com/pages/creation/" } })).not.toBeNull();
    expect(itemAction({ action: { kind: "portal", url: "http://business.facebook.com/latest/billing_hub" } })).toBeNull();
    expect(itemAction({ action: { kind: "portal", url: "https://facebook.com.evil.test/x" } })).toBeNull();
    expect(itemAction({ action: { kind: "portal", url: "not a url" } })).toBeNull();
    expect(itemAction({})).toBeNull();
  });
});
