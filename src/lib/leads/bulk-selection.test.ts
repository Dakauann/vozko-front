import { describe, expect, it } from "vitest";

import { encodeFilterParam, filterPredicates, type CrmFilter } from "@/lib/crm/board";
import { initialBulkSelection, widened, withPicked } from "@/lib/selection/bulk-state";
import { leadsQueryString } from "@/lib/leads/query";

import {
  LEAD_BULK_ACTIONS,
  confirmedSelection,
  effectiveLeadFilter,
  leadBulkActionStates,
  leadSelection,
  leadSelectionScope,
  leadSelectionSort,
  pickedAfterMapChange,
  EMPTY_LEAD_ACTION_DRAFT,
  leadActionParams,
  visibleMapPicks,
  typedCountMatches,
  parseTypedCount,
  leadBulkAccess,
  type LeadBulkContext,
} from "./bulk-selection";

const BAIRRO: CrmFilter = {
  groups: [{ conjunction: "and", predicates: [{ field: "district", operator: "in", values: ["barueri|centro"] }] }],
};

const SORTS = [{ key: "lastActivityAt" as const, direction: "desc" as const }];

describe("effectiveLeadFilter", () => {
  it("folds the search into the filter as the query predicate the list applies", () => {
    const effective = effectiveLeadFilter(BAIRRO, "  maria ");
    expect(filterPredicates(effective)).toEqual([
      { field: "district", operator: "in", values: ["barueri|centro"] },
      { field: "query", operator: "contains", values: ["maria"] },
    ]);
  });

  it("leaves the filter alone without a search", () => {
    expect(effectiveLeadFilter(BAIRRO, "  ")).toEqual(BAIRRO);
  });

  it("asks the list for the same leads the selection posts", () => {
    const listed = new URLSearchParams(leadsQueryString({ filter: effectiveLeadFilter(BAIRRO, "maria"), page: 1, pageSize: 20 }));
    expect(listed.get("q")).toBeNull();
    expect(listed.get("filter")).toBe(encodeFilterParam(effectiveLeadFilter(BAIRRO, "maria")));
    const selection = leadSelection(
      widened(initialBulkSelection("s"), { mode: "all_matching", scope: "s", matched: 1204 }),
      { filter: BAIRRO, search: "maria", sorts: SORTS },
    );
    expect(selection?.filter).toEqual(effectiveLeadFilter(BAIRRO, "maria"));
  });
});

describe("leadSelectionScope", () => {
  it("changes when the filter, the search or the sort changes, and only then", () => {
    const base = leadSelectionScope({ filter: BAIRRO, search: "maria", sorts: SORTS });
    expect(leadSelectionScope({ filter: BAIRRO, search: "maria", sorts: SORTS })).toBe(base);
    expect(leadSelectionScope({ filter: BAIRRO, search: "joao", sorts: SORTS })).not.toBe(base);
    expect(leadSelectionScope({ filter: BAIRRO, search: "maria", sorts: [] })).not.toBe(base);
    expect(leadSelectionScope({ filter: { groups: [] }, search: "maria", sorts: SORTS })).not.toBe(base);
  });
});

describe("leadSelection", () => {
  const context = { filter: BAIRRO, search: "", sorts: SORTS };

  it("sends picked rows as explicit ids, from every page", () => {
    const state = withPicked(initialBulkSelection("s"), new Set(["l-1", "l-2", "l-9"]));
    expect(leadSelection(state, context)).toEqual({ mode: "ids", ids: ["l-1", "l-2", "l-9"] });
  });

  it("selects every lead of the effective filter", () => {
    const state = widened(initialBulkSelection("s"), { mode: "all_matching", scope: "s", matched: 1204 });
    expect(leadSelection(state, { ...context, search: "maria" })).toEqual({
      mode: "all_matching",
      filter: effectiveLeadFilter(BAIRRO, "maria"),
    });
  });

  it("selects the first N by the current sort", () => {
    const state = widened(initialBulkSelection("s"), { mode: "first_n", scope: "s", matched: 1204, limit: 500 });
    expect(leadSelection(state, context)).toEqual({
      mode: "first_n",
      filter: BAIRRO,
      sort: [{ field: "lastActivityAt", desc: true }],
      limit: 500,
    });
  });

  it("selects the whole workspace without any filter", () => {
    const state = widened(initialBulkSelection("s"), { mode: "everyone", scope: "s", matched: 7942 });
    expect(leadSelection(state, context)).toEqual({ mode: "everyone" });
  });

  it("selects nothing when nothing is picked", () => {
    expect(leadSelection(initialBulkSelection("s"), context)).toBeNull();
  });

  it("confirms a filtered selection with the count and fingerprint the preview answered", () => {
    expect(
      confirmedSelection({ mode: "all_matching", filter: BAIRRO }, { expectedCount: 1204, fingerprint: "fp-1" }),
    ).toEqual({ mode: "all_matching", filter: BAIRRO, expectedCount: 1204, fingerprint: "fp-1" });
  });

  it("sends picked ids without a count", () => {
    expect(confirmedSelection({ mode: "ids", ids: ["l-1"] }, { expectedCount: 1, fingerprint: "fp" })).toEqual({
      mode: "ids",
      ids: ["l-1"],
    });
  });
});

describe("leadSelectionSort", () => {
  it("maps the list sort to the selection order", () => {
    expect(
      leadSelectionSort([
        { key: "name", direction: "asc" },
        { key: "createdAt", direction: "desc" },
      ]),
    ).toEqual([
      { field: "name", desc: false },
      { field: "createdAt", desc: true },
    ]);
  });
});

describe("parseTypedCount", () => {
  it("reads a positive count with or without thousand separators", () => {
    expect(parseTypedCount("7942")).toBe(7942);
    expect(parseTypedCount(" 7.942 ")).toBe(7942);
    expect(parseTypedCount("1,204")).toBe(1204);
  });

  it("refuses text, zero and counts past the safe range", () => {
    expect(parseTypedCount("")).toBeNull();
    expect(parseTypedCount("12a")).toBeNull();
    expect(parseTypedCount("-3")).toBeNull();
    expect(parseTypedCount("0")).toBeNull();
    expect(parseTypedCount("9".repeat(20))).toBeNull();
  });
});

describe("typedCountMatches", () => {
  it("accepts the count with or without thousand separators", () => {
    expect(typedCountMatches("7942", 7942)).toBe(true);
    expect(typedCountMatches("7.942", 7942)).toBe(true);
    expect(typedCountMatches(" 7 942 ", 7942)).toBe(true);
  });

  it("refuses anything else", () => {
    expect(typedCountMatches("", 7942)).toBe(false);
    expect(typedCountMatches("7941", 7942)).toBe(false);
    expect(typedCountMatches("79420", 7942)).toBe(false);
    expect(typedCountMatches("0", 0)).toBe(false);
  });
});

describe("leadBulkActionStates", () => {
  const allowed: LeadBulkContext = {
    filterInvalid: false,
    hasSelection: true,
    hasEditableFields: true,
    checking: false,
    permissions: { bulkEdit: true, assign: true, block: true, export: true, metaAudience: true, manageCallLists: true },
    sends: { send_template: { enabled: true }, send_message: { enabled: true } },
    noDialableLine: false,
  };

  it("lists the actions in the bar order", () => {
    expect(LEAD_BULK_ACTIONS).toEqual([
      "send_template",
      "send_message",
      "call_list",
      "classify",
      "assign_owner",
      "export",
      "meta_audience",
      "block",
    ]);
  });

  it("enables the record actions for a holder of every permission", () => {
    const states = leadBulkActionStates(allowed);
    for (const action of ["classify", "assign_owner", "export", "meta_audience", "block"] as const) {
      expect(states[action], action).toEqual({ enabled: true });
    }
  });

  it("offers the sends by the send gate once there is a selection", () => {
    expect(leadBulkActionStates(allowed).send_template).toEqual({ enabled: true });
    const noNumber = { enabled: false as const, reason: "noOfficialNumber" as const };
    const states = leadBulkActionStates({ ...allowed, sends: { send_template: noNumber, send_message: { enabled: false, reason: "permissionSendUnofficial" } } });
    expect(states.send_template).toEqual(noNumber);
    expect(states.send_message).toEqual({ enabled: false, reason: "permissionSendUnofficial" });
    expect(leadBulkActionStates({ ...allowed, hasSelection: false }).send_template).toEqual({ enabled: false, reason: "empty" });
  });

  it("never builds bulk parameters for a send, which has its own dialog", () => {
    expect(leadActionParams("send_template", EMPTY_LEAD_ACTION_DRAFT)).toBeNull();
    expect(leadActionParams("send_unofficial", EMPTY_LEAD_ACTION_DRAFT)).toBeNull();
  });

  it("offers a call list to whoever manages call lists", () => {
    expect(leadBulkActionStates(allowed).call_list).toEqual({ enabled: true });
    expect(leadBulkActionStates({ ...allowed, permissions: { ...allowed.permissions, manageCallLists: false } }).call_list).toEqual({
      enabled: false,
      reason: "permissionCallList",
    });
    expect(leadBulkActionStates({ ...allowed, hasSelection: false }).call_list).toEqual({ enabled: false, reason: "empty" });
    expect(leadBulkActionStates({ ...allowed, checking: true }).call_list).toEqual({ enabled: false, reason: "checkingAccess" });
  });

  it("refuses a call list only when the workspace has no line to call through", () => {
    expect(leadBulkActionStates({ ...allowed, noDialableLine: true }).call_list).toEqual({ enabled: false, reason: "noDialableLine" });
    expect(
      leadBulkActionStates({ ...allowed, noDialableLine: true, permissions: { ...allowed.permissions, manageCallLists: false } }).call_list,
    ).toEqual({ enabled: false, reason: "permissionCallList" });
    expect(leadBulkActionStates({ ...allowed, noDialableLine: true }).classify).toEqual({ enabled: true });
  });

  it("says which permission is missing", () => {
    const states = leadBulkActionStates({
      ...allowed,
      permissions: { bulkEdit: false, assign: false, block: false, export: false, metaAudience: false, manageCallLists: false },
    });
    expect(states.classify).toEqual({ enabled: false, reason: "permissionBulkEdit" });
    expect(states.assign_owner).toEqual({ enabled: false, reason: "permissionBulkEdit" });
    expect(states.block).toEqual({ enabled: false, reason: "permissionBulkEdit" });
    expect(states.export).toEqual({ enabled: false, reason: "permissionExport" });
    expect(states.meta_audience).toEqual({ enabled: false, reason: "permissionMetaAudience" });
  });

  it("needs the assign and block permissions on top of the bulk edit one", () => {
    const states = leadBulkActionStates({ ...allowed, permissions: { ...allowed.permissions, assign: false, block: false } });
    expect(states.assign_owner).toEqual({ enabled: false, reason: "permissionAssign" });
    expect(states.block).toEqual({ enabled: false, reason: "permissionBlock" });
  });

  it("refuses classification without a field the viewer can fill", () => {
    expect(leadBulkActionStates({ ...allowed, hasEditableFields: false }).classify).toEqual({
      enabled: false,
      reason: "noFields",
    });
  });

  it("refuses every action on a broken filter link", () => {
    const states = leadBulkActionStates({ ...allowed, filterInvalid: true });
    for (const action of ["classify", "assign_owner", "export", "meta_audience", "block"] as const) {
      expect(states[action], action).toEqual({ enabled: false, reason: "invalidFilter" });
    }
  });

  it("waits for the access check before offering an action", () => {
    const states = leadBulkActionStates({ ...allowed, checking: true });
    for (const action of ["classify", "assign_owner", "export", "meta_audience", "block"] as const) {
      expect(states[action], action).toEqual({ enabled: false, reason: "checkingAccess" });
    }
  });

  it("refuses every action on an empty selection", () => {
    const states = leadBulkActionStates({ ...allowed, hasSelection: false });
    expect(states.export).toEqual({ enabled: false, reason: "empty" });
  });
});

describe("leadBulkAccess", () => {
  it("reads each permission from the catalog capability the server enforces", () => {
    const asked: string[][] = [];
    const access = leadBulkAccess((keys) => {
      asked.push([...keys]);
      return keys.includes("leads.export") || keys.includes("leads.read_addresses") ? "denied" : "granted";
    });
    expect(asked).toEqual(
      expect.arrayContaining([
        ["leads.bulk_edit"],
        ["leads.assign"],
        ["leads.block"],
        ["leads.export"],
        ["leads.meta_audience"],
        ["leads.read_addresses"],
        ["leads.read_sensitive"],
        ["call_lists.manage"],
      ]),
    );
    expect(access).toEqual({
      checking: false,
      permissions: { bulkEdit: true, assign: true, block: true, export: false, metaAudience: true, manageCallLists: true },
      readsAddresses: false,
      readsSensitive: true,
    });
  });

  it("grants nothing while the catalog loads, and says it is still checking", () => {
    expect(leadBulkAccess(() => "loading")).toEqual({
      checking: true,
      permissions: { bulkEdit: false, assign: false, block: false, export: false, metaAudience: false, manageCallLists: false },
      readsAddresses: false,
      readsSensitive: false,
    });
  });
});

describe("map picks on the shared selection", () => {
  it("shows a dot as picked only while all its leads are still picked", () => {
    const picks = { p1: ["l-1", "l-2"], p2: ["l-3"] };
    expect(visibleMapPicks(picks, new Set(["l-1", "l-2", "l-9"]))).toEqual({ p1: ["l-1", "l-2"] });
  });

  it("adds the leads of a newly picked dot to the selection", () => {
    const next = pickedAfterMapChange(new Set(["l-9"]), {}, { p1: ["l-1", "l-2"] });
    expect([...next].sort()).toEqual(["l-1", "l-2", "l-9"]);
  });

  it("takes the leads of an unpicked dot out of the selection, keeping table picks", () => {
    const next = pickedAfterMapChange(new Set(["l-1", "l-2", "l-9"]), { p1: ["l-1", "l-2"] }, {});
    expect([...next]).toEqual(["l-9"]);
  });
});

describe("leadActionParams", () => {
  const draft = { ...EMPTY_LEAD_ACTION_DRAFT };

  it("needs a field and a value to classify, and sends null to clear", () => {
    expect(leadActionParams("classify", draft)).toBeNull();
    expect(leadActionParams("classify", { ...draft, key: "interesse" })).toBeNull();
    expect(leadActionParams("classify", { ...draft, key: "interesse", value: "  " })).toBeNull();
    expect(leadActionParams("classify", { ...draft, key: "interesse", value: [] })).toBeNull();
    expect(leadActionParams("classify", { ...draft, key: "interesse", value: "matriculado" })).toEqual({ key: "interesse", value: "matriculado" });
    expect(leadActionParams("classify", { ...draft, key: "interesse", clear: true, value: "x" })).toEqual({ key: "interesse", value: null });
    expect(leadActionParams("classify", { ...draft, key: "vip", value: false })).toEqual({ key: "vip", value: false });
  });

  it("assigns an owner or removes it, and asks for nothing until one is chosen", () => {
    expect(EMPTY_LEAD_ACTION_DRAFT.ownerId).toBeNull();
    expect(leadActionParams("assign_owner", draft)).toBeNull();
    expect(leadActionParams("assign_owner", { ...draft, ownerId: "u-1" })).toEqual({ ownerId: "u-1" });
    expect(leadActionParams("assign_owner", { ...draft, ownerId: "" })).toEqual({ ownerId: "" });
  });

  it("blocks or unblocks", () => {
    expect(leadActionParams("block", { ...draft, blocked: true })).toEqual({ blocked: true });
    expect(leadActionParams("block", { ...draft, blocked: false })).toEqual({ blocked: false });
  });

  it("exports a csv with the column tiers asked for", () => {
    expect(leadActionParams("export", draft)).toEqual({ format: "csv", addresses: false, sensitive: false });
    expect(leadActionParams("export", { ...draft, addresses: true })).toEqual({ format: "csv", addresses: true, sensitive: false });
  });

  it("needs a name, someone to call and a phone choice for a call list", () => {
    const callList = { ...EMPTY_LEAD_ACTION_DRAFT.callList, name: " Retorno ", assigneeIds: ["u-1", "u-2"] };
    expect(EMPTY_LEAD_ACTION_DRAFT.callList).toEqual({ name: "", assigneeIds: [], phoneSource: "identity", phoneLabel: "" });
    expect(leadActionParams("call_list", draft)).toBeNull();
    expect(leadActionParams("call_list", { ...draft, callList: { ...callList, name: "  " } })).toBeNull();
    expect(leadActionParams("call_list", { ...draft, callList: { ...callList, assigneeIds: [] } })).toBeNull();
    expect(leadActionParams("call_list", { ...draft, callList })).toEqual({
      callList: { name: "Retorno", assigneeIds: ["u-1", "u-2"], phoneSource: "identity" },
    });
    expect(leadActionParams("call_list", { ...draft, callList: { ...callList, phoneSource: "contact" } })).toBeNull();
    expect(leadActionParams("call_list", { ...draft, callList: { ...callList, phoneSource: "contact", phoneLabel: "landline" } })).toEqual({
      callList: { name: "Retorno", assigneeIds: ["u-1", "u-2"], phoneSource: "contact", phoneLabel: "landline" },
    });
  });

  it("needs an ad account and a name for a Meta audience", () => {
    expect(leadActionParams("meta_audience", { ...draft, adAccountId: "acc-1" })).toBeNull();
    expect(leadActionParams("meta_audience", { ...draft, name: "Base" })).toBeNull();
    expect(leadActionParams("meta_audience", { ...draft, adAccountId: "acc-1", name: " Base ", description: "  " })).toEqual({
      adAccountId: "acc-1",
      name: "Base",
    });
    expect(
      leadActionParams("meta_audience", { ...draft, adAccountId: "acc-1", name: "Base", description: "Pais" }),
    ).toEqual({ adAccountId: "acc-1", name: "Base", description: "Pais" });
  });
});
