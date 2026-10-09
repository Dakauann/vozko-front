import type { CapabilityDecision } from "@/lib/access/decide";
import type { CallListPhoneSource } from "@/lib/call-lists/types";
import { encodeFilterParam, isEmptyCrmFilter, type CrmFilter } from "@/lib/crm/board";
import { withText } from "@/lib/filters/controls";
import { firstBlocker, type ActionState } from "@/lib/selection/action-state";
import type { BulkSelectionState } from "@/lib/selection/bulk-state";
import type { LeadSendBlocker, LeadSendStates } from "@/lib/leads/sends";
import type { LeadPhoneLabel, LeadSort } from "@/lib/leads/types";

import type { LeadActionKind, LeadActionParams, LeadSelection, LeadSelectionSort } from "./actions";

export const LEAD_SEARCH_FIELD = "query";

export function effectiveLeadFilter(filter: CrmFilter, search: string): CrmFilter {
  return search.trim() ? withText(filter, LEAD_SEARCH_FIELD, search) : filter;
}

export interface LeadSelectionContext {
  filter: CrmFilter;
  search: string;
  sorts: readonly LeadSort[];
}

export function leadSelectionSort(sorts: readonly LeadSort[]): LeadSelectionSort[] {
  return sorts.map((sort) => ({ field: sort.key, desc: sort.direction === "desc" }));
}

export function leadSelectionScope({ filter, search, sorts }: LeadSelectionContext): string {
  const order = sorts.map((sort) => `${sort.key}:${sort.direction}`).join(",");
  return `${encodeFilterParam(effectiveLeadFilter(filter, search))}|${order}`;
}

export function leadSelection(state: BulkSelectionState, context: LeadSelectionContext): LeadSelection | null {
  const { wide } = state;
  if (!wide) {
    return state.picked.size > 0 ? { mode: "ids", ids: [...state.picked] } : null;
  }
  if (wide.mode === "everyone") return { mode: "everyone" };
  const filter = effectiveLeadFilter(context.filter, context.search);
  if (isEmptyCrmFilter(filter)) return null;
  if (wide.mode === "all_matching") return { mode: "all_matching", filter };
  if (wide.limit === undefined || wide.limit < 1) return null;
  return { mode: "first_n", filter, sort: leadSelectionSort(context.sorts), limit: wide.limit };
}

export interface SelectionConfirmation {
  expectedCount: number;
  fingerprint: string;
}

export function confirmedSelection(selection: LeadSelection, confirmation: SelectionConfirmation): LeadSelection {
  if (selection.mode === "ids") return selection;
  return { ...selection, expectedCount: confirmation.expectedCount, fingerprint: confirmation.fingerprint };
}

const THOUSANDS_SEPARATORS = /[\s.,]/g;

export function parseTypedCount(text: string): number | null {
  const digits = text.replace(THOUSANDS_SEPARATORS, "");
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function typedCountMatches(typed: string, count: number): boolean {
  return count > 0 && parseTypedCount(typed) === count;
}

export const LEAD_BULK_ACTIONS = [
  "send_template",
  "send_message",
  "call_list",
  "classify",
  "assign_owner",
  "export",
  "meta_audience",
  "block",
] as const;

export type LeadBulkAction = (typeof LEAD_BULK_ACTIONS)[number];

export type LeadBulkBlocker =
  | LeadSendBlocker
  | "empty"
  | "invalidFilter"
  | "checkingAccess"
  | "noFields"
  | "permissionBulkEdit"
  | "permissionAssign"
  | "permissionBlock"
  | "permissionExport"
  | "permissionMetaAudience"
  | "permissionCallList"
  | "noDialableLine";

export interface LeadBulkPermissions {
  bulkEdit: boolean;
  assign: boolean;
  block: boolean;
  export: boolean;
  metaAudience: boolean;
  manageCallLists: boolean;
}

export interface LeadBulkContext {
  filterInvalid: boolean;
  hasSelection: boolean;
  hasEditableFields: boolean;
  checking: boolean;
  permissions: LeadBulkPermissions;
  sends: LeadSendStates;
  noDialableLine: boolean;
}

export type LeadBulkActionStates = Record<LeadBulkAction, ActionState<LeadBulkBlocker>>;

export function leadBulkActionStates({ filterInvalid, hasSelection, hasEditableFields, checking, permissions, sends, noDialableLine }: LeadBulkContext): LeadBulkActionStates {
  const selectable: [boolean, LeadBulkBlocker][] = [
    [filterInvalid, "invalidFilter"],
    [!hasSelection, "empty"],
    [checking, "checkingAccess"],
  ];
  const selected = firstBlocker(selectable);
  return {
    send_template: selected.enabled ? sends.send_template : selected,
    send_message: selected.enabled ? sends.send_message : selected,
    call_list: firstBlocker([...selectable, [!permissions.manageCallLists, "permissionCallList"], [noDialableLine, "noDialableLine"]]),
    classify: firstBlocker([...selectable, [!permissions.bulkEdit, "permissionBulkEdit"], [!hasEditableFields, "noFields"]]),
    assign_owner: firstBlocker([...selectable, [!permissions.bulkEdit, "permissionBulkEdit"], [!permissions.assign, "permissionAssign"]]),
    export: firstBlocker([...selectable, [!permissions.export, "permissionExport"]]),
    meta_audience: firstBlocker([...selectable, [!permissions.metaAudience, "permissionMetaAudience"]]),
    block: firstBlocker([...selectable, [!permissions.bulkEdit, "permissionBulkEdit"], [!permissions.block, "permissionBlock"]]),
  };
}

const LEAD_BULK_CAPABILITIES: Record<keyof LeadBulkPermissions | "readsAddresses" | "readsSensitive", string> = {
  bulkEdit: "leads.bulk_edit",
  assign: "leads.assign",
  block: "leads.block",
  export: "leads.export",
  metaAudience: "leads.meta_audience",
  manageCallLists: "call_lists.manage",
  readsAddresses: "leads.read_addresses",
  readsSensitive: "leads.read_sensitive",
};

export interface LeadBulkAccess {
  checking: boolean;
  permissions: LeadBulkPermissions;
  readsAddresses: boolean;
  readsSensitive: boolean;
}

export function leadBulkAccess(decide: (keys: readonly string[]) => CapabilityDecision): LeadBulkAccess {
  let checking = false;
  const granted = (name: keyof typeof LEAD_BULK_CAPABILITIES) => {
    const decision = decide([LEAD_BULK_CAPABILITIES[name]]);
    if (decision === "loading") checking = true;
    return decision === "granted";
  };
  const permissions: LeadBulkPermissions = {
    bulkEdit: granted("bulkEdit"),
    assign: granted("assign"),
    block: granted("block"),
    export: granted("export"),
    metaAudience: granted("metaAudience"),
    manageCallLists: granted("manageCallLists"),
  };
  const readsAddresses = granted("readsAddresses");
  const readsSensitive = granted("readsSensitive");
  return { checking, permissions, readsAddresses, readsSensitive };
}

export type MapPickGroups = Readonly<Record<string, readonly string[]>>;

export function visibleMapPicks(picks: MapPickGroups, picked: ReadonlySet<string>): MapPickGroups {
  const visible: Record<string, readonly string[]> = {};
  for (const [pointId, leadIds] of Object.entries(picks)) {
    if (leadIds.length > 0 && leadIds.every((id) => picked.has(id))) visible[pointId] = leadIds;
  }
  return visible;
}

export function pickedAfterMapChange(picked: ReadonlySet<string>, before: MapPickGroups, after: MapPickGroups): ReadonlySet<string> {
  const next = new Set(picked);
  for (const [pointId, leadIds] of Object.entries(before)) {
    if (!(pointId in after)) for (const id of leadIds) next.delete(id);
  }
  for (const [pointId, leadIds] of Object.entries(after)) {
    if (!(pointId in before)) for (const id of leadIds) next.add(id);
  }
  return next;
}

export interface CallListDraft {
  name: string;
  assigneeIds: string[];
  phoneSource: CallListPhoneSource;
  phoneLabel: LeadPhoneLabel | "";
}

export interface LeadActionDraft {
  key: string;
  value: unknown;
  clear: boolean;
  ownerId: string | null;
  blocked: boolean;
  addresses: boolean;
  sensitive: boolean;
  adAccountId: string;
  name: string;
  description: string;
  callList: CallListDraft;
}

export const EMPTY_LEAD_ACTION_DRAFT: LeadActionDraft = {
  key: "",
  value: undefined,
  clear: false,
  ownerId: null,
  blocked: true,
  addresses: false,
  sensitive: false,
  adAccountId: "",
  name: "",
  description: "",
  callList: { name: "", assigneeIds: [], phoneSource: "identity", phoneLabel: "" },
};

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function leadActionParams(action: LeadActionKind, draft: LeadActionDraft): LeadActionParams | null {
  switch (action) {
    case "classify":
      if (!draft.key) return null;
      if (draft.clear) return { key: draft.key, value: null };
      return hasValue(draft.value) ? { key: draft.key, value: draft.value } : null;
    case "assign_owner":
      return draft.ownerId === null ? null : { ownerId: draft.ownerId };
    case "block":
      return { blocked: draft.blocked };
    case "export":
      return { format: "csv", addresses: draft.addresses, sensitive: draft.sensitive };
    case "meta_audience": {
      const name = draft.name.trim();
      const description = draft.description.trim();
      if (!draft.adAccountId || !name) return null;
      return { adAccountId: draft.adAccountId, name, ...(description ? { description } : {}) };
    }
    case "call_list": {
      const { assigneeIds, phoneSource, phoneLabel } = draft.callList;
      const name = draft.callList.name.trim();
      if (!name || assigneeIds.length === 0) return null;
      if (phoneSource === "contact" && !phoneLabel) return null;
      const label = phoneSource === "contact" && phoneLabel ? { phoneLabel } : {};
      return { callList: { name, assigneeIds: [...assigneeIds], phoneSource, ...label } };
    }
    case "send_template":
    case "send_unofficial":
      return null;
  }
}
