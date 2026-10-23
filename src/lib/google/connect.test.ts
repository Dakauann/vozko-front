import { describe, expect, it } from "vitest";

import { googleConnectErrorOf, googleResultFromMessage, googleResultFromQuery, googleStartPath } from "@/lib/google/connect";

describe("google connect results", () => {
  it("reads a connected popup message with its product and email", () => {
    expect(googleResultFromMessage({ source: "google-login", status: "connected", product: "sheets", email: "ops@example.com" })).toEqual({
      status: "connected",
      product: "sheets",
      email: "ops@example.com",
    });
  });

  it("keeps known refusal codes and folds unknown ones into connect_failed", () => {
    expect(googleResultFromMessage({ status: "error", product: "calendar", reason: "google_account_scope_not_granted" })).toEqual({
      status: "error",
      product: "calendar",
      reason: "google_account_scope_not_granted",
    });
    expect(googleConnectErrorOf("something_new")).toBe("google_account_connect_failed");
  });

  it("ignores messages that carry no result", () => {
    expect(googleResultFromMessage({ status: "pending" })).toBeNull();
  });

  it("reads the redirect query when the popup was blocked", () => {
    expect(googleResultFromQuery(new URLSearchParams("google=connected&product=sheets"))).toEqual({ status: "connected", product: "sheets", email: undefined });
    expect(googleResultFromQuery(new URLSearchParams("tab=x"))).toBeNull();
  });

  it("builds one start path per product", () => {
    expect(googleStartPath("sheets")).toBe("/oauth/google/sheets/start");
    expect(googleStartPath("calendar")).toBe("/oauth/google/calendar/start");
  });
});
