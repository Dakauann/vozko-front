import { describe, expect, it } from "vitest";

import { hasTraffic, rateFraction, reputationScale } from "./figures";
import { accountStatusTone, activeDomains, domainStatusTone, isDormantAccount, isPausedAccount, hasOwnDomain, ladderSteps, probationDaysLeft, preferredSender, probationShare, sendableDomains, sendableSenders, usageShare } from "./ladder";
import { recordProgress, recordRows } from "./records";
import type { EmailDnsRecord, EmailDomain, EmailSender, EmailSetup } from "./types";

function domain(overrides: Partial<EmailDomain>): EmailDomain {
  return {
    id: "d-1",
    domain: "acme.com.br",
    kind: "own",
    status: "verified",
    connect_method: "manual",
    mail_from_domain: "bounce.acme.com.br",
    reply_domain: "reply.acme.com.br",
    records: [],
    failure_reason: "",
    verified_at: null,
    last_checked_at: null,
    retired: false,
    sendable: true,
    lifecycle: "active",
    actions: { recheck: true, remove: true },
    replies_paused: false,
    replies_paused_at: null,
    setup: { state: "done" },
    ...overrides,
  };
}

describe("recordRows", () => {
  const records: EmailDnsRecord[] = [
    { purpose: "dmarc", type: "TXT", name: "_dmarc.acme.com.br", host: "_dmarc", status: "unknown", value: "v=DMARC1; p=none;", priority: 0, ttl: 0 },
    { purpose: "reply_mx", type: "MX", name: "reply.acme.com.br", host: "reply", status: "pending", value: "inbound.example.com", priority: 10, ttl: 0 },
    { purpose: "dkim", type: "CNAME", name: "k1._domainkey.acme.com.br", host: "k1._domainkey", status: "verified", value: "k1.dkim.example.com", priority: 0, ttl: 0 },
    { purpose: "mail_from_spf", type: "TXT", name: "bounce.acme.com.br", host: "bounce", status: "verified", value: "v=spf1 include:example.com ~all", priority: 0, ttl: 0 },
  ];

  it("orders records by purpose, uses the backend host and status and shows priority only on MX", () => {
    const rows = recordRows(records);
    expect(rows.map((row) => row.purpose)).toEqual(["dkim", "mail_from_spf", "reply_mx", "dmarc"]);
    expect(rows.map((row) => row.host)).toEqual(["k1._domainkey", "bounce", "reply", "_dmarc"]);
    expect(rows.map((row) => row.status)).toEqual(["verified", "verified", "pending", "unknown"]);
    expect(rows.find((row) => row.purpose === "reply_mx")?.priority).toBe(10);
    expect(rows.find((row) => row.purpose === "dkim")?.priority).toBeNull();
    expect(rows[0].fullName).toBe("k1._domainkey.acme.com.br");
  });

  it("counts the records the backend confirmed", () => {
    expect(recordProgress(records)).toEqual({ verified: 2, total: 4 });
    expect(recordProgress([])).toEqual({ verified: 0, total: 0 });
  });
});

describe("account status", () => {
  it.each([
    { status: "active" as const, paused: false, dormant: false, tone: "healthy" },
    { status: "paused_by_provider" as const, paused: true, dormant: false, tone: "fault" },
    { status: "paused_by_platform" as const, paused: true, dormant: false, tone: "fault" },
    { status: "dormant" as const, paused: false, dormant: true, tone: "neutral" },
  ])("reads $status as paused=$paused dormant=$dormant with a $tone mark", ({ status, paused, dormant, tone }) => {
    expect(isPausedAccount(status)).toBe(paused);
    expect(isDormantAccount(status)).toBe(dormant);
    expect(accountStatusTone(status)).toBe(tone);
  });
});

describe("sending ladder", () => {
  it("marks the steps before the mode as done and the mode as current", () => {
    expect(ladderSteps("probation").map((step) => step.state)).toEqual(["current", "next", "next"]);
    expect(ladderSteps("trusted").map((step) => step.state)).toEqual(["done", "current", "next"]);
    expect(ladderSteps("own_domain").map((step) => step.state)).toEqual(["done", "done", "current"]);
  });

  it("measures probation progress from the backend days", () => {
    const targets = { days: 14, min_delivered: 200, max_bounce_per_mil: 20, max_complaint_per_10k: 8 };
    const probation = { days: 7, required_days: 14, delivered: 120, hard_bounces: 1, complaints: 0, outcome: "too_soon" as const, targets };
    expect(probationShare(probation)).toBe(0.5);
    expect(probationDaysLeft(probation)).toBe(7);
    expect(probationShare({ ...probation, days: 20 })).toBe(1);
    expect(probationDaysLeft({ ...probation, days: 20 })).toBe(0);
    expect(probationShare({ ...probation, required_days: 0 })).toBe(0);
  });

  it("reads usage only when the backend says the domain is capped", () => {
    expect(usageShare(domain({ used_today: 250, cap_today: 500, daily_limit: "capped" }))).toBe(0.5);
    expect(usageShare(domain({ used_today: 900, cap_today: 500, daily_limit: "capped" }))).toBe(1);
    expect(usageShare(domain({}))).toBeNull();
    expect(usageShare(domain({ used_today: 1, cap_today: 0, daily_limit: "capped" }))).toBeNull();
    expect(usageShare(domain({ used_today: 80_000, daily_limit: "unlimited" }))).toBeNull();
    expect(usageShare(domain({ used_today: 0, daily_limit: "blocked" }))).toBeNull();
  });

  it("keeps a releasing domain out of the active and sendable ones", () => {
    const setup: EmailSetup = {
      provisioned: true,
      account: null,
      probation: null,
      senders: [],
      replies_paused: false,
      setup: { state: "done" },
      subdomain: { slug: "loja", address: "contato@loja.envios.example", locked: false }, activation: { allowed: true },
      domains: [domain({ id: "a", kind: "shared_probation" }), domain({ id: "b", retired: true, lifecycle: "releasing", sendable: false, actions: { recheck: false, remove: false } }), domain({ id: "c", sendable: false })],
    };
    expect(activeDomains(setup).map((d) => d.id)).toEqual(["a", "c"]);
    expect(sendableDomains(setup).map((d) => d.id)).toEqual(["a"]);
    expect(hasOwnDomain(setup)).toBe(true);
    expect(domainStatusTone("verifying")).toBe("warning");
    expect(domainStatusTone("failed")).toBe("fault");
  });

  it("keeps only the senders whose domain the backend says can send, and prefers the default one", () => {
    const sender = (id: string, domainId: string, isDefault = false): EmailSender => ({
      id,
      domain_id: domainId,
      address: `${id}@acme.com.br`,
      local_part: id,
      display_name: "",
      reply_forward_to: "",
      is_default: isDefault,
      domain_lifecycle: "active",
    });
    const setup: EmailSetup = {
      provisioned: true,
      account: null,
      probation: null,
      replies_paused: false,
      setup: { state: "done" },
      subdomain: { slug: "loja", address: "contato@loja.envios.example", locked: false }, activation: { allowed: true },
      domains: [domain({ id: "a" }), domain({ id: "b", retired: true, lifecycle: "releasing", sendable: false, actions: { recheck: false, remove: false } }), domain({ id: "c", sendable: false })],
      senders: [sender("vendas", "a"), sender("velho", "b", true), sender("novo", "c"), sender("contato", "a", true)],
    };
    const senders = sendableSenders(setup);
    expect(senders.map((s) => s.id)).toEqual(["vendas", "contato"]);
    expect(preferredSender(senders)?.id).toBe("contato");
    expect(preferredSender([sender("vendas", "a")])?.id).toBe("vendas");
    expect(preferredSender([])).toBeNull();
  });
});

describe("figures", () => {
  it("turns basis points into fractions", () => {
    expect(rateFraction(30)).toBe(0.003);
    expect(rateFraction(2500)).toBe(0.25);
  });

  it("places the backend warning and limit bands on the meter so the limit sits mid track until the rate passes it", () => {
    expect(reputationScale(150, 200, 500)).toEqual({ valueShare: 0.15, warningShare: 0.2, limitShare: 0.5 });
    expect(reputationScale(2000, 200, 500)).toEqual({ valueShare: 1, warningShare: 0.1, limitShare: 0.25 });
  });

  it("knows when the window has traffic", () => {
    expect(hasTraffic([{ bucket: "2026-10-20T03:00:00Z", sent: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0 }])).toBe(false);
    expect(hasTraffic([{ bucket: "2026-10-20T03:00:00Z", sent: 3, delivered: 0, opens: 0, clicks: 0, bounces: 0 }])).toBe(true);
  });
});
