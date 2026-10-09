import { describe, expect, it } from "vitest";

import { emptyCrmFilter, type CrmFilter } from "@/lib/crm/board";
import { effectiveLeadFilter } from "@/lib/leads/bulk-selection";

import { isRefusedFilter, leadsAssistantContext, listRefusedFilter, MAX_VIEW_SELECTED_LEADS, VIEW_FILTER_BUDGET_BYTES, type LeadsScopeLabels, type LeadsScreenState } from "./leads-context";

const labels: LeadsScopeLabels = {
  all: "Todos os leads",
  filtered: (conditions) => `${conditions} condições`,
  selected: (count) => `${count} selecionados`,
};

const bairro: CrmFilter = {
  groups: [
    {
      conjunction: "and",
      predicates: [
        { field: "district", operator: "in", values: ["sp-3550308|vila-mariana"] },
        { field: "owner", operator: "eq", values: ["u-1"] },
      ],
    },
  ],
};

describe("leadsAssistantContext", () => {
  it("publishes the effective filter the list uses, search folded in as the query predicate", () => {
    const context = leadsAssistantContext({ filter: bairro, search: " maria ", filterInvalid: false, filterRejected: false, selected: 0 }, labels);
    expect(context?.kind).toBe("leads");
    expect(context?.view.surface).toBe("leads");
    const predicates = context?.view.leadFilter?.groups.flatMap((group) => group.predicates) ?? [];
    expect(predicates).toContainEqual({ field: "query", operator: "contains", values: ["maria"] });
    expect(predicates).toContainEqual({ field: "district", operator: "in", values: ["sp-3550308|vila-mariana"] });
    expect(context?.view).not.toHaveProperty("selectedLeads");
    expect(context?.scope).toEqual({ filter: "3 condições" });
  });

  it("says the whole base when nothing filters the list, and sends no filter", () => {
    const context = leadsAssistantContext({ filter: emptyCrmFilter, search: "  ", filterInvalid: false, filterRejected: false, selected: 0 }, labels);
    expect(context?.view).toEqual({ surface: "leads" });
    expect(context?.scope).toEqual({ filter: "Todos os leads" });
  });

  it("tells how many leads are selected", () => {
    const context = leadsAssistantContext({ filter: bairro, search: "", filterInvalid: false, filterRejected: false, selected: 1840 }, labels);
    expect(context?.view.selectedLeads).toBe(1840);
    expect(context?.scope).toEqual({ filter: "2 condições", selected: "1840 selecionados" });
  });

  it("publishes nothing while the filter in the address cannot be read, so Elo never acts on a filter nobody sees", () => {
    expect(leadsAssistantContext({ filter: bairro, search: "", filterInvalid: true, filterRejected: false, selected: 3 }, labels)).toBeNull();
  });

  it("publishes nothing for a filter or a count the server would refuse, so the chat keeps working", () => {
    const huge: CrmFilter = {
      groups: [{ conjunction: "and", predicates: [{ field: "query", operator: "contains", values: ["x".repeat(VIEW_FILTER_BUDGET_BYTES)] }] }],
    };
    expect(leadsAssistantContext({ filter: huge, search: "", filterInvalid: false, filterRejected: false, selected: 0 }, labels)).toBeNull();
    expect(leadsAssistantContext({ filter: bairro, search: "", filterInvalid: false, filterRejected: false, selected: MAX_VIEW_SELECTED_LEADS + 1 }, labels)).toBeNull();
  });

  it("keeps a filter within a byte budget that no server encoding can push over its limit, whatever the characters", () => {
    const withValue = (value: string): LeadsScreenState => ({
      filter: { groups: [{ conjunction: "and", predicates: [{ field: "query", operator: "contains", values: [value] }] }] },
      search: "",
      filterInvalid: false,
      filterRejected: false,
      selected: 0,
    });
    const frame = new TextEncoder().encode(JSON.stringify(withValue("").filter)).length;
    const fits = "<".repeat(VIEW_FILTER_BUDGET_BYTES - frame);
    expect(leadsAssistantContext(withValue(fits), labels)?.view.leadFilter).toEqual(withValue(fits).filter);
    expect(leadsAssistantContext(withValue(fits + "x"), labels)).toBeNull();
    expect(leadsAssistantContext(withValue("ã".repeat(Math.ceil((VIEW_FILTER_BUDGET_BYTES - frame) / 2) + 1)), labels)).toBeNull();
  });

  it("publishes nothing while the list itself refused the filter, so the chat never breaks on it", () => {
    expect(leadsAssistantContext({ filter: bairro, search: "", filterInvalid: false, filterRejected: true, selected: 3 }, labels)).toBeNull();
  });

  it("drops a selection count that is not a whole number of leads", () => {
    expect(leadsAssistantContext({ filter: bairro, search: "", filterInvalid: false, filterRejected: false, selected: Number.NaN }, labels)?.view).not.toHaveProperty("selectedLeads");
    expect(leadsAssistantContext({ filter: bairro, search: "", filterInvalid: false, filterRejected: false, selected: -4 }, labels)?.view).not.toHaveProperty("selectedLeads");
  });
});

describe("filters the list refused", () => {
  it("remembers the filter only when the list answered that the filter is invalid", () => {
    expect(listRefusedFilter(bairro, "lead_filter_invalid")).toBe(JSON.stringify(bairro));
    expect(listRefusedFilter(bairro, "internal")).toBeNull();
    expect(listRefusedFilter(bairro, null)).toBeNull();
  });

  it("matches the screen only while it still shows the refused filter", () => {
    const refused = listRefusedFilter(effectiveLeadFilter(bairro, "maria"), "lead_filter_invalid");
    expect(isRefusedFilter(refused, bairro, "maria")).toBe(true);
    expect(isRefusedFilter(refused, bairro, "")).toBe(false);
    expect(isRefusedFilter(null, bairro, "maria")).toBe(false);
  });
});
