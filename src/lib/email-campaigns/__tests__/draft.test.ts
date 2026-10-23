import { describe, expect, it } from "vitest";

import type { CrmFilter } from "@/lib/crm/board";
import type { Document } from "@/lib/email-design/types";

import { emptyAudienceDraft } from "@/lib/campaign-audience/draft";

import { audienceSelection, campaignRequest, draftOf, duplicateRequest, emptyDraft, parseTestAddresses, requestFingerprint, runeLength } from "../draft";
import type { Campaign } from "../types";

const DOC: Document = {
  version: 1,
  settings: { preheader: "Novidades" },
  blocks: [{ id: "footer", kind: "footer", footer: { company_name: "Loja", address: "Rua 1" } }],
};

const FILTER: CrmFilter = { groups: [{ predicates: [{ field: "city", operator: "in", values: ["sp"] }] }] } as unknown as CrmFilter;

function campaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: "c1",
    name: "Black Friday",
    status: "draft",
    sender_id: "s1",
    subject: "Oferta para {{first_name|você}}",
    preheader: "Só hoje",
    document: DOC,
    selection: { mode: "all_matching", filter: FILTER },
    ab_test: { variant_b_subject: "30% off", test_percent: 20, winner_metric: "clicks", decide_after_minutes: 120 },
    actions: ["edit", "delete", "schedule", "launch"],
    billing: {
      batch_size: 1000,
      current_batch: 0,
      charged_units: 0,
      charged_micros: 0,
      sent_units: 0,
      refunded_units: 0,
      refunded_micros: 0,
      final_micros: 0,
      settled_at: null,
      refund_pending_micros: 0,
      exchange_rate: null,
      charged_brl: null,
      refunded_brl: null,
      final_brl: null,
      refund_pending_brl: null,
    },
    time_zone: "America/Sao_Paulo",
    created_at: "2026-10-21T10:00:00Z",
    updated_at: "2026-10-21T10:00:00Z",
    ...overrides,
  };
}

const AUDIENCE = emptyAudienceDraft("email");

describe("audienceSelection", () => {
  it("preserves quantity, order and exclusions when a saved campaign is edited", () => {
    const selection = { mode: "first_n" as const, filter: FILTER, limit: 200000, sort: [{ field: "lastActivityAt", desc: true }], exclude_ids: ["l1"] };
    expect(campaignRequest(draftOf(campaign({ selection }))).selection).toEqual(selection);
  });

  it("does not expand an invalid quantity selection to every matching lead", () => {
    expect(audienceSelection({ ...AUDIENCE, pick: "first_n", filter: FILTER, limit: 0 })).toBeUndefined();
  });
  it("leaves the audience out until a filter is chosen", () => {
    expect(audienceSelection({ ...AUDIENCE, pick: "filter" })).toBeUndefined();
  });

  it("sends the whole base as everyone", () => {
    expect(audienceSelection({ ...AUDIENCE, pick: "everyone" })).toEqual({ mode: "everyone" });
  });

  it("folds the search into the filter", () => {
    const selection = audienceSelection({ ...AUDIENCE, search: "ana" });
    expect(selection?.mode).toBe("all_matching");
    expect(JSON.stringify(selection?.filter)).toContain("ana");
  });

  it("keeps a fixed list of leads", () => {
    expect(audienceSelection({ ...AUDIENCE, pick: "ids", ids: ["l1", "l2"] })).toEqual({ mode: "ids", ids: ["l1", "l2"] });
    expect(audienceSelection({ ...AUDIENCE, pick: "ids", ids: [] })).toBeUndefined();
  });

  it("sends the leads taken out of a filtered or whole base audience", () => {
    expect(audienceSelection({ ...AUDIENCE, pick: "everyone", excludeIds: ["l1"] })).toEqual({ mode: "everyone", exclude_ids: ["l1"] });
    expect(audienceSelection({ ...AUDIENCE, filter: FILTER, excludeIds: ["l2"] })).toEqual({ mode: "all_matching", filter: FILTER, exclude_ids: ["l2"] });
  });

  it("sends no selection for a list", () => {
    expect(audienceSelection({ ...AUDIENCE, source: "list", listId: "list-1", pick: "everyone" })).toBeUndefined();
  });
});

describe("campaignRequest", () => {
  it("builds the snake case body the backend expects", () => {
    expect(campaignRequest(draftOf(campaign()))).toEqual({
      name: "Black Friday",
      sender_id: "s1",
      subject: "Oferta para {{first_name|você}}",
      preheader: "Só hoje",
      document: DOC,
      selection: { mode: "all_matching", filter: FILTER },
      ab_test: { variant_b_subject: "30% off", test_percent: 20, winner_metric: "clicks", decide_after_minutes: 120 },
    });
  });

  it("omits what is not filled in and the a/b test when it is off", () => {
    const draft = { ...emptyDraft(), name: "  Rascunho  " };
    expect(campaignRequest(draft)).toEqual({ name: "Rascunho", subject: "" });
    expect(campaignRequest({ ...draft, ab: { ...draft.ab, variantBSubject: "B" } }).ab_test).toBeUndefined();
  });

  it("sends the list instead of a selection, with the merge policies", () => {
    const request = campaignRequest(draftOf(campaign({ selection: undefined, list_id: "list-1", merge_policies: [{ key: "first_name", missing: "text", text: "cliente" }, { key: "company", missing: "exclude" }] })));
    expect(request.list_id).toBe("list-1");
    expect(request.selection).toBeUndefined();
    expect(request.merge_policies).toEqual([{ key: "first_name", missing: "text", text: "cliente" }, { key: "company", missing: "exclude" }]);
  });

  it("keeps a text choice out of the save until it has a text", () => {
    const draft = draftOf(campaign());
    const request = campaignRequest({ ...draft, audience: { ...draft.audience, variables: { first_name: { missing: "text", text: "  " }, company: { missing: "exclude" } } } });
    expect(request.merge_policies).toEqual([{ key: "company", missing: "exclude" }]);
  });

  it("gives the same fingerprint for the same campaign", () => {
    expect(requestFingerprint(campaignRequest(draftOf(campaign())))).toBe(requestFingerprint(campaignRequest(draftOf(campaign()))));
  });
});

describe("draftOf", () => {
  it("treats an empty document as no document yet", () => {
    expect(draftOf(campaign({ document: { version: 1, settings: {}, blocks: [] } })).document).toBeNull();
  });

  it("reads the list and the merge policies back into the audience", () => {
    const audience = draftOf(campaign({ selection: undefined, list_id: "list-1", merge_policies: [{ key: "first_name", missing: "text", text: "cliente" }] })).audience;
    expect(audience).toMatchObject({ source: "list", listId: "list-1", variables: { first_name: { missing: "text", text: "cliente" } } });
  });

  it("reads a pick by ids and a filter as lead audiences", () => {
    expect(draftOf(campaign({ selection: { mode: "ids", ids: ["l1"] } })).audience).toMatchObject({ source: "leads", pick: "ids", ids: ["l1"] });
    expect(draftOf(campaign()).audience).toMatchObject({ source: "leads", pick: "filter", filter: FILTER });
  });

  it("reads the leads taken out back into the audience", () => {
    expect(draftOf(campaign({ selection: { mode: "everyone", exclude_ids: ["l1"] } })).audience).toMatchObject({ pick: "everyone", excludeIds: ["l1"] });
    expect(draftOf(campaign({ selection: { mode: "all_matching", filter: FILTER, exclude_ids: ["l2"] } })).audience).toMatchObject({ pick: "filter", excludeIds: ["l2"] });
  });

  it("never copies the list of a draft into its duplicate", () => {
    const copy = duplicateRequest(campaign({ selection: undefined, list_id: "list-1" }), "Cópia");
    expect(copy.list_id).toBeUndefined();
    expect(copy.selection).toBeUndefined();
  });

  it("drops a decided winner so a copy can run its own test", () => {
    const copy = duplicateRequest(campaign({ ab_test: { variant_b_subject: "B", test_percent: 30, winner_metric: "opens", decide_after_minutes: 60, winner: "b" } }), "Cópia");
    expect(copy.name).toBe("Cópia");
    expect(copy.ab_test).toEqual({ variant_b_subject: "B", test_percent: 30, winner_metric: "opens", decide_after_minutes: 60 });
    expect(copy.selection).toEqual({ mode: "all_matching", filter: FILTER });
  });
});

describe("test addresses", () => {
  it("splits on commas, semicolons and lines and removes repeats", () => {
    expect(parseTestAddresses("ana@a.com, bia@b.com;\nANA@a.com  caio@c.com")).toEqual(["ana@a.com", "bia@b.com", "caio@c.com"]);
    expect(parseTestAddresses("   ")).toEqual([]);
  });

  it("counts characters the way the backend counts runes", () => {
    expect(runeLength("Olá 👋")).toBe(5);
  });
});
