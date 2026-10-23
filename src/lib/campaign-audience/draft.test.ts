import { describe, expect, it } from "vitest";

import { emptyCrmFilter, type CrmFilter } from "@/lib/crm/board";

import {
  audienceCreateState,
  audienceSpecFor,
  audienceSpecOf,
  channelFieldsReady,
  defaultSourceOf,
  emptyAudienceDraft,
  keptChoices,
  leadsSelectionOf,
  listContextFor,
  recipientsOf,
  sourcesOf,
  withExcludedLeads,
  withIncludedLeads,
  withNewLead,
  withPickedLeads,
  withVariableChoice,
} from "./draft";
import type { AudienceCount } from "./types";

const FILTER: CrmFilter = { groups: [{ conjunction: "and", predicates: [{ field: "city", operator: "in", values: ["sp"] }] }] } as CrmFilter;

const COUNT: AudienceCount = {
  channel: "whatsapp",
  source: "leads",
  matched: 10,
  withContact: 9,
  sendable: 8,
  out: {},
  outTotal: 1,
  requiredVariables: 1,
  variables: [{ key: "1", name: "1", header: false, missing: 0, policy: "", suggested: true, choiceRequired: false }],
  blockers: [],
  selection: { selected: 10, confirmCount: 10, fingerprint: "fp" },
  list: null,
  metadataMissing: [],
};

describe("audience sources per channel", () => {
  it("starts the official template on the list and every other channel on the leads", () => {
    expect(defaultSourceOf("whatsapp")).toBe("list");
    expect(defaultSourceOf("email")).toBe("leads");
    expect(defaultSourceOf("unofficial")).toBe("leads");
    expect(defaultSourceOf("carrier")).toBe("leads");
    expect(emptyAudienceDraft("whatsapp").source).toBe("list");
  });

  it("offers only the leads for the carrier channel", () => {
    expect(sourcesOf("carrier")).toEqual(["leads"]);
    expect(sourcesOf("email")).toEqual(["leads", "list"]);
  });
});

describe("leadsSelectionOf", () => {
  it("needs a filter or a search to count filtered leads", () => {
    expect(leadsSelectionOf({ pick: "filter", filter: emptyCrmFilter, search: "", ids: [] })).toBeNull();
    expect(leadsSelectionOf({ pick: "filter", filter: FILTER, search: "", ids: [] })).toEqual({ mode: "all_matching", filter: FILTER });
  });

  it("takes everyone or the picked ids", () => {
    expect(leadsSelectionOf({ pick: "everyone", filter: FILTER, search: "", ids: [] })).toEqual({ mode: "everyone" });
    expect(leadsSelectionOf({ pick: "ids", filter: emptyCrmFilter, search: "", ids: [] })).toBeNull();
    expect(leadsSelectionOf({ pick: "ids", filter: emptyCrmFilter, search: "", ids: ["a"] })).toEqual({ mode: "ids", ids: ["a"] });
  });
});

describe("audienceSpecOf", () => {
  it("sends the lead selection with the variable choices", () => {
    const draft = withVariableChoice({ ...emptyAudienceDraft("unofficial"), pick: "everyone" }, "1", { missing: "text", text: "cliente" });
    expect(audienceSpecOf(draft)).toEqual({ source: "leads", selection: { mode: "everyone" }, variables: [{ key: "1", missing: "text", text: "cliente" }] });
  });

  it("sends the list once one exists", () => {
    const draft = emptyAudienceDraft("whatsapp");
    expect(audienceSpecOf(draft)).toBeNull();
    expect(audienceSpecOf({ ...draft, listId: "list-1" })).toEqual({ source: "list", listId: "list-1" });
  });
});

describe("withVariableChoice", () => {
  it("keeps a typed text only with the text policy and a value only with a literal source", () => {
    let draft = withVariableChoice(emptyAudienceDraft("whatsapp"), "1", { missing: "text", text: "cliente" });
    draft = withVariableChoice(draft, "1", { missing: "exclude" });
    expect(draft.variables["1"]).toEqual({ missing: "exclude" });
    draft = withVariableChoice(draft, "1", { source: "literal", value: "1º ano" });
    draft = withVariableChoice(draft, "1", { source: "lead.city" });
    expect(draft.variables["1"]).toEqual({ missing: "exclude", source: "lead.city" });
  });
});

describe("keptChoices", () => {
  it("drops the choices of variables the server no longer lists", () => {
    const draft = withVariableChoice(withVariableChoice(emptyAudienceDraft("email"), "first_name", { missing: "exclude" }), "company", { missing: "exclude" });
    expect(Object.keys(keptChoices(draft.variables, [{ ...COUNT.variables[0], key: "first_name" }]))).toEqual(["first_name"]);
  });
});

describe("recipientsOf", () => {
  it("confirms a lead selection with the count the server returned", () => {
    const spec = audienceSpecOf({ ...emptyAudienceDraft("whatsapp"), source: "leads", pick: "filter", filter: FILTER });
    expect(spec && recipientsOf(spec, COUNT)).toEqual({ source: "leads", selection: { mode: "all_matching", filter: FILTER, expectedCount: 10, fingerprint: "fp" } });
  });

  it("leaves a pick by ids and a list as they are", () => {
    const ids = { source: "leads" as const, selection: { mode: "ids" as const, ids: ["a"] } };
    expect(recipientsOf(ids, COUNT)).toEqual(ids);
    expect(recipientsOf({ source: "list", listId: "l" }, { ...COUNT, selection: null })).toEqual({ source: "list", listId: "l" });
  });
});

describe("picking and dropping leads", () => {
  it("drops leads from a filtered audience and sends them as excluded", () => {
    const filtered = { ...emptyAudienceDraft("email"), filter: FILTER };
    const dropped = withExcludedLeads(withExcludedLeads(filtered, ["a", "b"]), ["b", "c"]);
    expect(dropped.excludeIds).toEqual(["a", "b", "c"]);
    expect(leadsSelectionOf(dropped)).toEqual({ mode: "all_matching", filter: FILTER, excludeIds: ["a", "b", "c"] });
    expect(leadsSelectionOf({ ...dropped, pick: "everyone" })).toEqual({ mode: "everyone", excludeIds: ["a", "b", "c"] });
  });

  it("sends only the picked leads and keeps the filter to go back to", () => {
    const filtered = withExcludedLeads({ ...emptyAudienceDraft("whatsapp"), source: "list" as const, filter: FILTER }, ["x"]);
    const picked = withPickedLeads(filtered, ["a", "b", "a"]);
    expect(picked).toMatchObject({ source: "leads", pick: "ids", ids: ["a", "b"], filter: FILTER });
    expect(leadsSelectionOf(picked)).toEqual({ mode: "ids", ids: ["a", "b"] });
  });

  it("puts the excluded leads back", () => {
    const dropped = withExcludedLeads({ ...emptyAudienceDraft("email"), filter: FILTER }, ["a"]);
    expect(leadsSelectionOf(withIncludedLeads(dropped))).toEqual({ mode: "all_matching", filter: FILTER });
  });
});

describe("withNewLead", () => {
  it("adds the saved lead to a pick by ids and leaves a filter untouched", () => {
    const picked = { ...emptyAudienceDraft("email"), pick: "ids" as const, ids: ["a"] };
    expect(withNewLead(picked, "b").ids).toEqual(["a", "b"]);
    expect(withNewLead(picked, "a").ids).toEqual(["a"]);
    const filtered = { ...emptyAudienceDraft("email"), filter: FILTER };
    expect(withNewLead(filtered, "b")).toBe(filtered);
  });
});

describe("channelFieldsReady", () => {
  it("counts the WhatsApp channels before the template or the message and waits only for the carrier kind", () => {
    expect(channelFieldsReady("whatsapp", {})).toBe(true);
    expect(channelFieldsReady("unofficial", {})).toBe(true);
    expect(channelFieldsReady("carrier", { kind: "marketing" })).toBe(true);
    expect(channelFieldsReady("carrier", {})).toBe(false);
    expect(channelFieldsReady("email", {})).toBe(true);
  });
});

describe("audienceSpecFor", () => {
  const draft = withVariableChoice({ ...emptyAudienceDraft("whatsapp"), source: "leads" as const, pick: "everyone" as const }, "1", { missing: "exclude" });

  it("drops the variable choices while there is no template or message to hold them", () => {
    expect(audienceSpecFor("whatsapp", {}, draft)).toEqual({ source: "leads", selection: { mode: "everyone" } });
    expect(audienceSpecFor("unofficial", {}, draft)).toEqual({ source: "leads", selection: { mode: "everyone" } });
  });

  it("leaves them out of the list context too", () => {
    expect(listContextFor("whatsapp", {}, draft)).toEqual({});
    expect(listContextFor("whatsapp", { templateId: "t" }, draft)).toEqual({ templateId: "t", variables: [{ key: "1", missing: "exclude" }] });
  });

  it("keeps them once the template or the message exists", () => {
    expect(audienceSpecFor("whatsapp", { templateId: "t" }, draft)?.variables).toEqual([{ key: "1", missing: "exclude" }]);
    expect(audienceSpecFor("unofficial", { message: { kind: "text", bodies: ["Oi {{1}}"] } }, draft)?.variables).toEqual([{ key: "1", missing: "exclude" }]);
    expect(audienceSpecFor("email", {}, draft)?.variables).toEqual([{ key: "1", missing: "exclude" }]);
  });
});


describe("audienceCreateState", () => {
  const spec = { source: "leads" as const, selection: { mode: "everyone" as const } };

  it("waits for an audience and for the count", () => {
    expect(audienceCreateState({ spec: null, pending: false, count: null })).toEqual({ ready: false, reason: "no_audience" });
    expect(audienceCreateState({ spec, pending: true, count: COUNT })).toEqual({ ready: false, reason: "counting" });
    expect(audienceCreateState({ spec, pending: false, count: null })).toEqual({ ready: false, reason: "count_failed" });
  });

  it("is closed while the server lists a blocker and names the variable", () => {
    const blocked: AudienceCount = {
      ...COUNT,
      sendable: null,
      blockers: ["variable_choice_required"],
      variables: [
        { key: "1", name: "1", header: false, missing: 0, policy: "", suggested: true, choiceRequired: false },
        { key: "3", name: "3", header: false, missing: 18, policy: "", suggested: false, choiceRequired: true },
      ],
    };
    expect(audienceCreateState({ spec, pending: false, count: blocked })).toEqual({ ready: false, reason: "variable_choice_required", slot: "3" });
    const missingList: AudienceCount = { ...COUNT, blockers: ["list_variables_missing"], variables: [{ key: "2", name: "2", header: false, missing: 7, policy: "", suggested: false, choiceRequired: false }] };
    expect(audienceCreateState({ spec, pending: false, count: missingList })).toEqual({ ready: false, reason: "list_variables_missing", slot: "2" });
  });

  it("is closed while rows or leads lack the metadata the flow or agent needs", () => {
    expect(audienceCreateState({ spec, pending: false, count: { ...COUNT, blockers: ["list_metadata_missing"] } })).toEqual({ ready: false, reason: "list_metadata_missing" });
    expect(audienceCreateState({ spec, pending: false, count: { ...COUNT, blockers: ["leads_metadata_unavailable"] } })).toEqual({ ready: false, reason: "leads_metadata_unavailable" });
  });

  it("opens once the server counts without blockers", () => {
    expect(audienceCreateState({ spec, pending: false, count: COUNT })).toEqual({ ready: true });
  });
});
