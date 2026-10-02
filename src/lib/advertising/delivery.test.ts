import { describe, expect, it } from "vitest";

import { accountNotices, deliveryKey, deliveryTone, jobIsTerminal, jobTone, resultKind, rowIssues, spendBlockerKey } from "./delivery";
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
