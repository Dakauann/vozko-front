import { isEmptyCrmFilter, type CrmFilter } from "@/lib/crm/board";
import { effectiveLeadFilter } from "@/lib/leads/bulk-selection";
import { LEAD_FILTER_INVALID } from "@/lib/leads/filters";

import type { LeadsAssistantContext, LeadsAssistantScope } from "./assistant-context";
import type { LeadsView } from "./types";

const MAX_VIEW_FILTER_BYTES = 16 << 10;
const WORST_JSON_ESCAPE_GROWTH = 6;

export const VIEW_FILTER_BUDGET_BYTES = Math.floor(MAX_VIEW_FILTER_BYTES / WORST_JSON_ESCAPE_GROWTH);
export const MAX_VIEW_SELECTED_LEADS = 10_000_000;

export interface LeadsScreenState {
  filter: CrmFilter;
  search: string;
  filterInvalid: boolean;
  filterRejected: boolean;
  selected: number;
}

export interface LeadsScopeLabels {
  all: string;
  filtered: (conditions: number) => string;
  selected: (count: number) => string;
}

export function listRefusedFilter(requested: CrmFilter, errorCode: string | null): string | null {
  return errorCode === LEAD_FILTER_INVALID ? JSON.stringify(requested) : null;
}

export function isRefusedFilter(refused: string | null, filter: CrmFilter, search: string): boolean {
  return refused !== null && refused === JSON.stringify(effectiveLeadFilter(filter, search));
}

function plainBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function conditionsOf(filter: CrmFilter): number {
  return filter.groups.reduce((total, group) => total + group.predicates.length, 0);
}

function isWholeCount(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function leadsAssistantContext(state: LeadsScreenState, labels: LeadsScopeLabels): LeadsAssistantContext | null {
  if (state.filterInvalid || state.filterRejected) return null;
  if (state.selected > MAX_VIEW_SELECTED_LEADS) return null;
  const filter = effectiveLeadFilter(state.filter, state.search);
  const filtered = !isEmptyCrmFilter(filter);
  if (filtered && plainBytes(filter) > VIEW_FILTER_BUDGET_BYTES) return null;
  const view: LeadsView = { surface: "leads" };
  const scope: LeadsAssistantScope = { filter: filtered ? labels.filtered(conditionsOf(filter)) : labels.all };
  if (filtered) view.leadFilter = filter;
  if (isWholeCount(state.selected)) {
    view.selectedLeads = state.selected;
    scope.selected = labels.selected(state.selected);
  }
  return { kind: "leads", view, scope };
}
