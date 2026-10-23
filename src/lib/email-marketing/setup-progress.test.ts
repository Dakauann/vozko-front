import { describe, expect, it } from "vitest";

import { FIRST_POLL_MS, MAX_POLL_MS } from "@/lib/polling";

import { domainsNeedingSetup, isSettingUp, setupPollDelay } from "./setup-progress";
import type { EmailDomain, EmailSetup } from "./types";

function domain(id: string, state: EmailDomain["setup"]["state"], retired = false): EmailDomain {
  return {
    id,
    domain: `${id}.com.br`,
    kind: "own",
    status: state === "done" ? "verified" : "pending",
    connect_method: "manual",
    mail_from_domain: "",
    reply_domain: "",
    records: [],
    failure_reason: "",
    verified_at: null,
    last_checked_at: null,
    retired,
    sendable: state === "done" && !retired,
    lifecycle: retired ? "releasing" : "active",
    actions: { recheck: !retired, remove: !retired },
    replies_paused: false,
    replies_paused_at: null,
    setup: state === "failed" ? { state, error_code: "email_provider_unavailable" } : { state },
  };
}

function setup(state: EmailSetup["setup"]["state"], domains: EmailDomain[] = []): EmailSetup {
  return { provisioned: true, account: null, probation: null, senders: [], replies_paused: false, domains, setup: { state }, subdomain: { slug: "loja", address: "contato@loja.envios.example", locked: false }, activation: { allowed: true } };
}

describe("setup progress", () => {
  it("reads the backend state only", () => {
    expect(isSettingUp({ state: "in_progress" })).toBe(true);
    expect(isSettingUp({ state: "failed", error_code: "email_provider_unavailable" })).toBe(false);
    expect(isSettingUp({ state: "done" })).toBe(false);
    expect(isSettingUp(undefined)).toBe(false);
  });

  it("polls with the shared backoff while the setup runs and stops once it settles", () => {
    const first = setupPollDelay(setup("in_progress"), null);
    expect(first).toBe(FIRST_POLL_MS);
    const second = setupPollDelay(setup("in_progress"), first);
    expect(second).toBeGreaterThan(FIRST_POLL_MS);
    expect(setupPollDelay(setup("in_progress"), MAX_POLL_MS)).toBe(MAX_POLL_MS);
    expect(setupPollDelay(setup("failed"), second)).toBeNull();
    expect(setupPollDelay(setup("done"), second)).toBeNull();
    expect(setupPollDelay(undefined, second)).toBeNull();
  });

  it("lists the live domains whose setup the backend has not finished", () => {
    const value = setup("in_progress", [domain("a", "done"), domain("b", "in_progress"), domain("c", "failed"), domain("d", "failed", true)]);
    expect(domainsNeedingSetup(value).map((d) => d.id)).toEqual(["b", "c"]);
  });
});
