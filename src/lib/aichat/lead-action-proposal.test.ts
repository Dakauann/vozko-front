import { describe, expect, it } from "vitest";

import type { LeadActionPreview } from "@/lib/leads/actions";

import { fieldsShownByLeadActionPreview, leadActionProposalCounts, parseLeadActionProposal, showsQuoteFacts, withFinishedCount } from "./lead-action-proposal";

const quote = {
  count: 1200,
  parts: 1,
  splitRequired: false,
  maxPerCampaign: 150000,
  unitPriceMicros: 62500,
  costMicros: 75000000,
  balanceMicros: 50000000,
  currency: "USD",
  affordable: false,
  fits: 800,
  refusal: "unaffordable",
};

const prepare = {
  stage: "prepare",
  action: "classify",
  mode: "all_matching",
  previewId: "pv-1",
  matched: 5000,
  selected: 5000,
  eligible: 1800,
  partial: true,
  skipped: { unchanged: 200 },
};

function finished(result: Partial<LeadActionPreview["result"]>): LeadActionPreview {
  return {
    id: "pv-1",
    action: "classify",
    status: "done",
    result: { matched: 5000, expectedCount: 5000, fingerprint: "f", selected: 5000, eligible: 4700, skipped: { unchanged: 280, gone: 20 }, ...result },
  };
}

describe("parseLeadActionProposal", () => {
  it("reads the card the server built for a prepared edit, partial count included", () => {
    expect(parseLeadActionProposal(prepare)).toEqual({
      stage: "prepare",
      action: "classify",
      mode: "all_matching",
      previewId: "pv-1",
      matched: 5000,
      selected: 5000,
      eligible: 1800,
      partial: true,
      skipped: { unchanged: 200 },
      counted: {},
      parts: [],
    });
  });

  it("reads the send review with its quote and campaigns", () => {
    const parsed = parseLeadActionProposal({
      stage: "start",
      action: "send_template",
      matched: 1500,
      selected: 1500,
      eligible: 1200,
      partial: false,
      skipped: { blocked: 100, opted_out: 200 },
      counted: { window_open: 52 },
      quote,
      parts: [{ campaignId: "c-1", name: "Reativação", status: "stopped", entries: 1500, eligible: 1200 }],
    });
    expect(parsed?.quote).toEqual(quote);
    expect(parsed?.parts).toEqual([{ campaignId: "c-1", name: "Reativação", status: "stopped", entries: 1500, eligible: 1200 }]);
    expect(parsed?.counted).toEqual({ window_open: 52 });
  });

  it("refuses anything it cannot vouch for, so the card never shows made up numbers", () => {
    expect(parseLeadActionProposal(null)).toBeNull();
    expect(parseLeadActionProposal("lead_action")).toBeNull();
    expect(parseLeadActionProposal({ ...prepare, stage: "run" })).toBeNull();
    expect(parseLeadActionProposal({ ...prepare, action: "" })).toBeNull();
    expect(parseLeadActionProposal({ ...prepare, selected: -1 })).toBeNull();
    expect(parseLeadActionProposal({ ...prepare, eligible: 1.5 })).toBeNull();
    expect(parseLeadActionProposal({ ...prepare, matched: "5000" })).toBeNull();
    expect(parseLeadActionProposal({ ...prepare, partial: "yes" })).toBeNull();
    expect(parseLeadActionProposal({ ...prepare, skipped: { unchanged: -2 } })).toBeNull();
    expect(parseLeadActionProposal({ ...prepare, skipped: [] })).toBeNull();
    expect(parseLeadActionProposal({ ...prepare, quote: { count: 1 } })).toBeNull();
    expect(parseLeadActionProposal({ ...prepare, parts: [{ campaignId: "", name: "x", status: "stopped", entries: 1, eligible: 1 }] })).toBeNull();
    expect(parseLeadActionProposal({ ...prepare, previewId: 7 })).toBeNull();
  });

  it("treats a missing partial flag as a finished count and missing reasons as none", () => {
    const rest: Record<string, unknown> = { ...prepare };
    delete rest.partial;
    delete rest.skipped;
    expect(parseLeadActionProposal(rest)).toMatchObject({ partial: false, skipped: {}, counted: {} });
  });
});

describe("withFinishedCount", () => {
  it("replaces the partial numbers with the finished count of the same preview", () => {
    const card = parseLeadActionProposal(prepare)!;
    expect(withFinishedCount(card, finished({}))).toEqual({
      ...card,
      matched: 5000,
      selected: 5000,
      eligible: 4700,
      skipped: { unchanged: 280, gone: 20 },
      partial: false,
    });
  });

  it("keeps the card as it was when the answer belongs to another preview", () => {
    const card = parseLeadActionProposal(prepare)!;
    expect(withFinishedCount(card, { ...finished({}), id: "pv-2" })).toBe(card);
  });
});

describe("leadActionProposalCounts", () => {
  it("lists the skip reasons that hold leads, known ones first and in a stable order", () => {
    const card = parseLeadActionProposal({ ...prepare, skipped: { gone: 3, unchanged: 0, odd: 4 } })!;
    expect(leadActionProposalCounts(card)).toEqual({
      selected: 5000,
      eligible: 1800,
      skipped: [
        { reason: "gone", count: 3 },
        { reason: "odd", count: 4 },
      ],
      counted: [],
    });
  });

  it("orders send skips the way the leads screen does", () => {
    const card = parseLeadActionProposal({
      stage: "start",
      action: "send_unofficial",
      matched: 10,
      selected: 10,
      eligible: 4,
      partial: false,
      skipped: { cooldown: 1, no_identity: 2, blocked: 3 },
      counted: { no_consent_recorded: 2, window_open: 0 },
    })!;
    expect(leadActionProposalCounts(card).skipped.map((row) => row.reason)).toEqual(["no_identity", "blocked", "cooldown"]);
    expect(leadActionProposalCounts(card).counted).toEqual([{ reason: "no_consent_recorded", count: 2 }]);
  });
});

describe("fieldsShownByLeadActionPreview", () => {
  const send = { stage: "prepare", action: "send_template", matched: 1200, selected: 1200, eligible: 1200, partial: false, skipped: {}, quote };
  const started = {
    stage: "start",
    action: "send_template",
    matched: 1500,
    selected: 1500,
    eligible: 1200,
    partial: false,
    skipped: { blocked: 300 },
    quote: { ...quote, refusal: undefined, affordable: true, fits: 1200 },
  };
  const shown = (data: unknown) => [...fieldsShownByLeadActionPreview({ kind: "lead_action", data })].sort();

  it("covers the counts of a prepared edit, leaving the action and the selection to the card", () => {
    expect(shown(prepare)).toEqual(["changes", "skipped"]);
  });

  it("covers the quote of a prepared official send, never the next step", () => {
    expect(shown(send)).toEqual(["balance", "budget", "capRemaining", "estimatedCost", "parts"]);
  });

  it("covers the pace of a prepared unofficial send instead of its cost", () => {
    expect(shown({ ...send, action: "send_unofficial", quote: { ...quote, dailyCap: 300, estimatedDays: 4 } })).toEqual(["budget", "dailyCap", "estimatedDays", "parts"]);
  });

  it("covers who receives a started send and its quote only when everyone eligible receives", () => {
    expect(shown(started)).toEqual(["balance", "budget", "capRemaining", "counted", "estimatedCost", "parts", "recipients", "skipped"]);
    expect(shown({ ...started, eligible: 800 })).toEqual(["budget", "counted", "parts", "recipients", "skipped"]);
  });

  it("covers the entries of a discarded send", () => {
    expect(shown({ ...started, stage: "cancel" })).toEqual(["entries"]);
  });

  it("covers nothing when the preview is another kind or cannot be read, so the card keeps every row", () => {
    expect(fieldsShownByLeadActionPreview(undefined).size).toBe(0);
    expect(fieldsShownByLeadActionPreview({ kind: "message", data: prepare }).size).toBe(0);
    expect(fieldsShownByLeadActionPreview({ kind: "lead_action", data: { ...prepare, selected: "muitos" } }).size).toBe(0);
  });
});

describe("showsQuoteFacts", () => {
  it("shows the quote of a prepared send and of a start that reaches everyone it priced", () => {
    const prepared = parseLeadActionProposal({ stage: "prepare", action: "send_template", matched: 1200, selected: 1200, eligible: 1200, partial: false, quote })!;
    expect(showsQuoteFacts(prepared)).toBe(true);
    expect(showsQuoteFacts({ ...prepared, stage: "start", eligible: 1200 })).toBe(true);
    expect(showsQuoteFacts({ ...prepared, stage: "start", eligible: 800 })).toBe(false);
    expect(showsQuoteFacts(parseLeadActionProposal(prepare)!)).toBe(false);
  });
});
