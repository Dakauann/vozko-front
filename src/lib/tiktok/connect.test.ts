import { describe, expect, it } from "vitest";

import {
  TIKTOK_ACCOUNTS_PATH,
  TIKTOK_CONNECT_PATH,
  TIKTOK_OAUTH_START_PATH,
  TIKTOK_POPUP_SOURCE,
  connectErrorOf,
  connectResultFromMessage,
  connectResultFromQuery,
  tiktokAccountPath,
} from "@/lib/tiktok/connect";
import { TIKTOK_CONNECT_ERRORS } from "@/lib/tiktok/types";

describe("TikTok connect paths", () => {
  it("matches the backend popup source and paths", () => {
    expect(TIKTOK_POPUP_SOURCE).toBe("tiktok-login");
    expect(TIKTOK_ACCOUNTS_PATH).toBe("/dashboard/tiktok-accounts");
    expect(TIKTOK_CONNECT_PATH).toBe("/dashboard/tiktok-accounts/connect");
    expect(TIKTOK_OAUTH_START_PATH).toBe("/oauth/tiktok/start");
    expect(tiktokAccountPath("acc-1")).toBe("/dashboard/tiktok-accounts/acc-1");
  });
});

describe("TikTok connect results", () => {
  it("reads a connected popup message with the account", () => {
    expect(connectResultFromMessage({ source: "tiktok-login", status: "connected", username: "loja", accountId: "acc-1" })).toEqual({
      status: "connected",
      username: "loja",
      accountId: "acc-1",
    });
  });

  it("reads a reconnected popup message", () => {
    expect(connectResultFromMessage({ status: "reconnected", username: "loja", accountId: "acc-1" })?.status).toBe("reconnected");
  });

  it("keeps every documented error reason", () => {
    for (const reason of TIKTOK_CONNECT_ERRORS) {
      expect(connectResultFromMessage({ status: "error", reason })).toEqual({ status: "error", reason });
    }
  });

  it("turns an unknown error reason into the generic failure", () => {
    expect(connectResultFromMessage({ status: "error", reason: "something_new" })).toEqual({ status: "error", reason: "connect_failed" });
    expect(connectResultFromMessage({ status: "error" })).toEqual({ status: "error", reason: "connect_failed" });
  });

  it("reads a cancelled authorization without details", () => {
    expect(connectResultFromMessage({ status: "cancelled", reason: "declined" })).toEqual({ status: "cancelled" });
  });

  it("ignores a message without a known status", () => {
    expect(connectResultFromMessage({ status: "partial" })).toBeNull();
    expect(connectResultFromMessage({})).toBeNull();
  });

  it("drops non string details", () => {
    expect(connectResultFromMessage({ status: "connected", username: 7, accountId: "" })).toEqual({ status: "connected" });
  });

  it("reads the redirect fallback query", () => {
    expect(connectResultFromQuery(new URLSearchParams("tiktok=error&reason=already_linked"))).toEqual({
      status: "error",
      reason: "already_linked",
    });
    expect(connectResultFromQuery(new URLSearchParams("tiktok=connected&username=loja"))).toEqual({ status: "connected", username: "loja" });
    expect(connectResultFromQuery(new URLSearchParams("tiktok=cancelled&reason=declined"))).toEqual({ status: "cancelled" });
  });

  it("ignores a query without the TikTok marker", () => {
    expect(connectResultFromQuery(new URLSearchParams("mercadolivre=connected"))).toBeNull();
    expect(connectResultFromQuery(new URLSearchParams(""))).toBeNull();
  });

  it("maps a raw reason to a known error, falling back to the generic one", () => {
    expect(connectErrorOf("identity_mismatch")).toBe("identity_mismatch");
    expect(connectErrorOf("expired_state")).toBe("expired_state");
    expect(connectErrorOf("nope")).toBe("connect_failed");
    expect(connectErrorOf(undefined)).toBe("connect_failed");
  });
});
