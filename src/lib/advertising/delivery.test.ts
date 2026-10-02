import { describe, expect, it } from "vitest";

import {
  accountNotices,
  accountWritePermissions,
  deliveryKey,
  deliveryTone,
  jobIsTerminal,
  jobTone,
  manageBlockerKey,
  partitionBySpend,
  resultKind,
  rowIssues,
  spendBlockerKey,
  spendCapBlockerKey,
  toggleBlockerKey,
} from "./delivery";
import type { AdAccount } from "./types";

const account = (overrides: Partial<AdAccount> = {}): AdAccount => ({
  id: "a1",
  metaAccountId: "act_1",
  name: "Conta",
  currency: "BRL",
  timezone: "America/Sao_Paulo",
  metaStatus: "active",
  connection: "CONNECTED",
  hasFunding: true,
  canSpend: true,
  canManage: true,
  canSetSpendCap: true,
  role: "admin",
  ...overrides,
});

describe("delivery", () => {
  it("maps each delivery to a status tone", () => {
    expect(deliveryTone("active")).toBe("healthy");
    expect(deliveryTone("rejected")).toBe("fault");
    expect(deliveryTone("with_issues")).toBe("warning");
    expect(deliveryTone("in_review")).toBe("info");
    expect(deliveryTone("adset_off")).toBe("neutral");
  });

  it("falls back to unknown for values it has never seen", () => {
    expect(deliveryKey("something_new")).toBe("unknown");
    expect(deliveryTone("something_new")).toBe("neutral");
  });
});

describe("resultKind", () => {
  it("names the result type from the action", () => {
    expect(resultKind({ resultAction: "onsite_conversion.messaging_conversation_started_7d", mixedResults: false })).toBe(
      "conversations",
    );
    expect(resultKind({ resultAction: "link_click", mixedResults: false })).toBe("linkClicks");
    expect(resultKind({ resultAction: "impressions", mixedResults: false })).toBe("impressions");
  });

  it("has no kind for mixed or unknown actions", () => {
    expect(resultKind({ resultAction: "lead", mixedResults: true })).toBeNull();
    expect(resultKind({ resultAction: "", mixedResults: false })).toBeNull();
  });
});

describe("rowIssues", () => {
  it("joins delivery issues and review feedback", () => {
    expect(
      rowIssues({
        issues: [{ code: 1, summary: "Sem pagamento", message: "Adicione um cartão", level: "AD" }],
        reviewFeedback: { "Texto do anúncio": "Promessa enganosa" },
      }),
    ).toEqual([
      { title: "Sem pagamento", message: "Adicione um cartão" },
      { title: "Texto do anúncio", message: "Promessa enganosa" },
    ]);
    expect(rowIssues({ issues: null })).toEqual([]);
  });
});

describe("account notices", () => {
  it("asks only for reconnection when the connection is broken", () => {
    expect(accountNotices(account({ connection: "NEEDS_RECONNECT", hasFunding: false }))).toEqual(["reconnect"]);
  });

  it("flags payment and Meta status problems", () => {
    expect(accountNotices(account({ hasFunding: false }))).toEqual(["funding"]);
    expect(accountNotices(account({ metaStatus: "disabled" }))).toEqual(["metaStatus"]);
    expect(accountNotices(account({ metaStatus: "in_grace_period" }))).toEqual([]);
  });

  it("explains why an account cannot spend, failing closed", () => {
    expect(spendBlockerKey(account())).toBeNull();
    expect(spendBlockerKey(account({ canSpend: false, hasFunding: false }))).toBe("funding");
    expect(spendBlockerKey(account({ canSpend: false }))).toBe("unknown");
  });
});

describe("publish jobs", () => {
  it("knows which statuses are final", () => {
    expect(jobIsTerminal("RUNNING")).toBe(false);
    expect(jobIsTerminal("NEEDS_REVIEW")).toBe(true);
    expect(jobTone("FAILED")).toBe("fault");
    expect(jobTone("WHATEVER")).toBe("neutral");
  });
});

describe("toggleBlockerKey", () => {
  const can = { canStart: true, canStop: true };

  it("allows turning off without a payment method but not turning on", () => {
    const unfunded = account({ canSpend: false, hasFunding: false });
    expect(toggleBlockerKey({ isOn: true, canToggle: true }, unfunded, can)).toBeNull();
    expect(toggleBlockerKey({ isOn: false, canToggle: true }, unfunded, can)).toBe("funding");
    expect(toggleBlockerKey({ isOn: false, canToggle: true }, account(), can)).toBeNull();
  });

  it("explains locked objects and missing permissions first", () => {
    expect(toggleBlockerKey({ isOn: false, canToggle: false }, account(), can)).toBe("locked");
    expect(toggleBlockerKey({ isOn: false, canToggle: true }, account(), { canStart: false, canStop: true })).toBe("permission");
    expect(toggleBlockerKey({ isOn: true, canToggle: true }, account(), { canStart: true, canStop: false })).toBe("permission");
  });
});

describe("read-only accounts", () => {
  const readOnly = account({ canManage: false, canSpend: false, canSetSpendCap: false, role: "read_only" });
  const can = { canStart: true, canStop: true };

  it("explains the role instead of payment or status problems", () => {
    expect(accountNotices(account({ ...readOnly, hasFunding: false, metaStatus: "disabled" }))).toEqual(["readOnly"]);
    expect(accountNotices(account({ ...readOnly, connection: "NEEDS_RECONNECT" }))).toEqual(["reconnect"]);
  });

  it("names the role as the reason every write is blocked", () => {
    expect(manageBlockerKey(readOnly)).toBe("readOnly");
    expect(manageBlockerKey(account())).toBeNull();
    expect(manageBlockerKey(account({ canManage: false, connection: "NEEDS_RECONNECT" }))).toBe("reconnect");
    expect(spendBlockerKey(readOnly)).toBe("readOnly");
  });

  it("blocks switching off as well as switching on", () => {
    expect(toggleBlockerKey({ isOn: true, canToggle: true }, readOnly, can)).toBe("readOnly");
    expect(toggleBlockerKey({ isOn: false, canToggle: true }, readOnly, can)).toBe("readOnly");
  });

  it("lets only admins change the spend cap", () => {
    expect(spendCapBlockerKey(account())).toBeNull();
    expect(spendCapBlockerKey(account({ canSetSpendCap: false, role: "advertiser" }))).toBe("adminRequired");
    expect(spendCapBlockerKey(readOnly)).toBe("readOnly");
  });

  it("turns off every write permission of a blocked account", () => {
    const permissions = { canCreate: true, canUpdate: true, canDelete: false };
    expect(accountWritePermissions(permissions, readOnly)).toEqual({ canCreate: false, canUpdate: false, canDelete: false });
    expect(accountWritePermissions(permissions, account())).toEqual(permissions);
  });

  it("splits the accounts that can publish from the ones that cannot", () => {
    const ready = account();
    const unfunded = account({ canSpend: false, hasFunding: false });
    const needsReconnect = account({ ...readOnly, connection: "NEEDS_RECONNECT" });
    const split = partitionBySpend([ready, readOnly, unfunded, needsReconnect]);
    expect(split.ready).toEqual([ready]);
    expect(split.blocked).toEqual([readOnly, unfunded, needsReconnect]);
  });

  it("treats an account whose role is missing as read only", () => {
    const legacy = account({ canManage: undefined as unknown as boolean });
    expect(manageBlockerKey(legacy)).not.toBeNull();
  });
});
