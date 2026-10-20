import { describe, expect, it } from "vitest";

import {
  MERCADOLIVRE_ACCOUNTS_PATH,
  MERCADOLIVRE_POPUP_SOURCE,
  connectErrorOf,
  connectResultFromMessage,
  connectResultFromQuery,
} from "@/lib/mercadolivre/connect";
import { MERCADOLIVRE_CONNECT_ERRORS } from "@/lib/mercadolivre/types";

describe("Mercado Livre connect results", () => {
  it("matches the backend popup source and accounts path", () => {
    expect(MERCADOLIVRE_POPUP_SOURCE).toBe("mercadolivre-login");
    expect(MERCADOLIVRE_ACCOUNTS_PATH).toBe("/dashboard/mercadolivre-accounts");
  });

  it("reads a connected popup message with the account", () => {
    expect(
      connectResultFromMessage({ source: "mercadolivre-login", status: "connected", nickname: "LOJA", accountId: "acc-1" }),
    ).toEqual({ status: "connected", nickname: "LOJA", accountId: "acc-1" });
  });

  it("reads a reconnected popup message", () => {
    expect(connectResultFromMessage({ status: "reconnected", nickname: "LOJA", accountId: "acc-1" })?.status).toBe("reconnected");
  });

  it("keeps every documented error reason", () => {
    for (const reason of MERCADOLIVRE_CONNECT_ERRORS) {
      expect(connectResultFromMessage({ status: "error", reason })).toEqual({ status: "error", reason });
    }
  });

  it("turns an unknown error reason into the generic failure", () => {
    expect(connectResultFromMessage({ status: "error", reason: "something_new" })).toEqual({ status: "error", reason: "connect_failed" });
    expect(connectResultFromMessage({ status: "error" })).toEqual({ status: "error", reason: "connect_failed" });
  });

  it("ignores a message without a known status", () => {
    expect(connectResultFromMessage({ status: "partial" })).toBeNull();
    expect(connectResultFromMessage({})).toBeNull();
  });

  it("drops non string details", () => {
    expect(connectResultFromMessage({ status: "connected", nickname: 7, accountId: "" })).toEqual({ status: "connected" });
  });

  it("reads the redirect fallback query", () => {
    const params = new URLSearchParams("mercadolivre=error&reason=not_account_admin");
    expect(connectResultFromQuery(params)).toEqual({ status: "error", reason: "not_account_admin" });
    expect(connectResultFromQuery(new URLSearchParams("mercadolivre=connected&nickname=LOJA&accountId=acc-1"))).toEqual({
      status: "connected",
      nickname: "LOJA",
      accountId: "acc-1",
    });
  });

  it("ignores a query without the connect marker", () => {
    expect(connectResultFromQuery(new URLSearchParams("facebook=connected"))).toBeNull();
    expect(connectResultFromQuery(new URLSearchParams("mercadolivre=cancelled"))).toBeNull();
  });

  it("maps a raw reason to a known error, falling back to the generic one", () => {
    expect(connectErrorOf("already_linked")).toBe("already_linked");
    expect(connectErrorOf("nope")).toBe("connect_failed");
    expect(connectErrorOf(undefined)).toBe("connect_failed");
  });
});
