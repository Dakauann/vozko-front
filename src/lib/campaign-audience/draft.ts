import { emptyCrmFilter, isEmptyCrmFilter, type CrmFilter } from "@/lib/crm/board";
import { effectiveLeadFilter } from "@/lib/leads/bulk-selection";

import {
  LITERAL_AUDIENCE_SOURCE,
  type AudienceBlocker,
  type AudienceChannel,
  type AudienceCount,
  type AudienceSelection,
  type AudienceSource,
  type AudienceSpec,
  type AudienceVariable,
  type ChannelFields,
  type LeadsPick,
  type ListContext,
  type MissingPolicy,
  type VariableCount,
} from "./types";

export interface VariableChoice {
  source?: string;
  value?: string;
  missing?: MissingPolicy;
  text?: string;
}

export interface LeadsPickDraft {
  pick: LeadsPick;
  filter: CrmFilter;
  search: string;
  ids: string[];
  excludeIds?: string[];
  includeIds?: string[];
  limit?: number;
  sort?: AudienceSelection["sort"];
}

export interface AudienceDraft extends LeadsPickDraft {
  source: AudienceSource;
  listId: string | null;
  variables: Record<string, VariableChoice>;
}

const SOURCES_BY_CHANNEL: Record<AudienceChannel, readonly AudienceSource[]> = {
  email: ["leads", "list"],
  whatsapp: ["leads", "list"],
  unofficial: ["leads", "list"],
  carrier: ["leads"],
};

const DEFAULT_SOURCE: Record<AudienceChannel, AudienceSource> = {
  email: "leads",
  whatsapp: "list",
  unofficial: "leads",
  carrier: "leads",
};

export function sourcesOf(channel: AudienceChannel): readonly AudienceSource[] {
  return SOURCES_BY_CHANNEL[channel];
}

export function defaultSourceOf(channel: AudienceChannel): AudienceSource {
  return DEFAULT_SOURCE[channel];
}

export function emptyAudienceDraft(channel: AudienceChannel): AudienceDraft {
  return { source: defaultSourceOf(channel), pick: "filter", filter: emptyCrmFilter, search: "", ids: [], excludeIds: [], includeIds: [], listId: null, variables: {} };
}

function withAdjustments(selection: AudienceSelection, { excludeIds, includeIds }: Pick<LeadsPickDraft, "excludeIds" | "includeIds">): AudienceSelection {
  const adjusted = { ...selection };
  if (includeIds && includeIds.length > 0) adjusted.includeIds = [...includeIds];
  if (excludeIds && excludeIds.length > 0) adjusted.excludeIds = [...excludeIds];
  return adjusted;
}

export function leadsSelectionOf(draft: LeadsPickDraft): AudienceSelection | null {
  const { pick, filter, search, ids, limit, sort } = draft;
  if (pick === "everyone") return withAdjustments({ mode: "everyone" }, draft);
  if (pick === "ids") return ids.length > 0 ? { mode: "ids", ids: [...ids] } : null;
  const effective = effectiveLeadFilter(filter, search);
  if (pick === "first_n") {
    if (isEmptyCrmFilter(effective) || !Number.isSafeInteger(limit) || (limit ?? 0) < 1) return null;
    return withAdjustments({ mode: "first_n", filter: effective, limit, sort }, draft);
  }
  return isEmptyCrmFilter(effective) ? null : withAdjustments({ mode: "all_matching", filter: effective }, draft);
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function without(ids: readonly string[] | undefined, dropped: readonly string[]): string[] {
  const gone = new Set(dropped);
  return (ids ?? []).filter((id) => !gone.has(id));
}

export function withPickedLeads(draft: AudienceDraft, ids: readonly string[]): AudienceDraft {
  return { ...draft, source: "leads", pick: "ids", ids: unique(ids) };
}

export function withExcludedLeads(draft: AudienceDraft, ids: readonly string[]): AudienceDraft {
  return { ...draft, includeIds: without(draft.includeIds, ids), excludeIds: unique([...(draft.excludeIds ?? []), ...ids]) };
}

function choosesNobodyYet(draft: LeadsPickDraft): boolean {
  return draft.pick === "filter" && isEmptyCrmFilter(effectiveLeadFilter(draft.filter, draft.search));
}

export function withIncludedLead<T extends LeadsPickDraft>(draft: T, leadId: string): T {
  if (draft.pick === "ids" || choosesNobodyYet(draft)) return { ...draft, pick: "ids", ids: unique([...draft.ids, leadId]) };
  return { ...draft, includeIds: unique([...(draft.includeIds ?? []), leadId]), excludeIds: without(draft.excludeIds, [leadId]) };
}

export function withoutChosenLead<T extends LeadsPickDraft>(draft: T, leadId: string): T {
  if (draft.pick === "ids") return { ...draft, ids: without(draft.ids, [leadId]) };
  return { ...draft, includeIds: without(draft.includeIds, [leadId]) };
}

export function chosenLeadsOf(draft: LeadsPickDraft): readonly string[] {
  return draft.pick === "ids" ? draft.ids : (draft.includeIds ?? []);
}

export function withRestoredLeads(draft: AudienceDraft): AudienceDraft {
  return { ...draft, excludeIds: [] };
}

function variableOf(key: string, choice: VariableChoice): AudienceVariable {
  const variable: AudienceVariable = { key };
  if (choice.source) variable.source = choice.source;
  if (choice.source === LITERAL_AUDIENCE_SOURCE) variable.value = choice.value ?? "";
  if (choice.missing) variable.missing = choice.missing;
  if (choice.missing === "text") variable.text = choice.text ?? "";
  return variable;
}

export function audienceVariablesOf(choices: Record<string, VariableChoice>): AudienceVariable[] {
  return Object.entries(choices).map(([key, choice]) => variableOf(key, choice));
}

function withVariables(spec: AudienceSpec, choices: Record<string, VariableChoice>): AudienceSpec {
  const variables = audienceVariablesOf(choices);
  return variables.length > 0 ? { ...spec, variables } : spec;
}

export function audienceSpecOf(draft: AudienceDraft): AudienceSpec | null {
  if (draft.source === "list") return draft.listId ? withVariables({ source: "list", listId: draft.listId }, draft.variables) : null;
  const selection = leadsSelectionOf(draft);
  return selection ? withVariables({ source: "leads", selection }, draft.variables) : null;
}

export function withVariableChoice(draft: AudienceDraft, key: string, patch: VariableChoice): AudienceDraft {
  const merged: VariableChoice = { ...draft.variables[key], ...patch };
  if (merged.missing !== "text") delete merged.text;
  if (merged.source !== LITERAL_AUDIENCE_SOURCE) delete merged.value;
  return { ...draft, variables: { ...draft.variables, [key]: merged } };
}

export function keptChoices(choices: Record<string, VariableChoice>, variables: readonly VariableCount[]): Record<string, VariableChoice> {
  const listed = new Set(variables.map((variable) => variable.key));
  return Object.fromEntries(Object.entries(choices).filter(([key]) => listed.has(key)));
}

export function recipientsOf(spec: AudienceSpec, count: AudienceCount): AudienceSpec {
  const selection = spec.selection;
  if (!selection || selection.mode === "ids" || !count.selection) return spec;
  const confirmed: AudienceSelection = { ...selection, expectedCount: count.selection.confirmCount };
  if (count.selection.fingerprint) confirmed.fingerprint = count.selection.fingerprint;
  return { ...spec, selection: confirmed };
}

export function channelFieldsReady(channel: AudienceChannel, fields: ChannelFields): boolean {
  return channel !== "carrier" || Boolean(fields.kind);
}

function holdsVariables(channel: AudienceChannel, fields: ChannelFields): boolean {
  if (channel === "whatsapp") return Boolean(fields.templateId);
  if (channel === "unofficial") return Boolean(fields.message);
  return true;
}

export function listContextFor(channel: AudienceChannel, fields: ChannelFields, draft: AudienceDraft): ListContext {
  return listContextOf(fields, holdsVariables(channel, fields) ? draft.variables : {});
}

export function audienceSpecFor(channel: AudienceChannel, fields: ChannelFields, draft: AudienceDraft): AudienceSpec | null {
  return audienceSpecOf(holdsVariables(channel, fields) ? draft : { ...draft, variables: {} });
}

export type AudienceCreateReason = "no_audience" | "counting" | "count_failed" | AudienceBlocker;

export type AudienceCreateState = { ready: true } | { ready: false; reason: AudienceCreateReason; slot?: string };

const BLOCKING_VARIABLE: Partial<Record<AudienceBlocker, (variable: VariableCount) => boolean>> = {
  variable_choice_required: (variable) => variable.choiceRequired,
  variable_source_required: (variable) => !variable.source,
  list_variables_missing: (variable) => variable.missing > 0,
};

export function audienceCreateState({ spec, pending, count }: { spec: AudienceSpec | null; pending: boolean; count: AudienceCount | null }): AudienceCreateState {
  if (!spec) return { ready: false, reason: "no_audience" };
  if (pending) return { ready: false, reason: "counting" };
  if (!count) return { ready: false, reason: "count_failed" };
  const blocker = count.blockers[0];
  if (!blocker) return { ready: true };
  const blocking = BLOCKING_VARIABLE[blocker];
  const slot = blocking ? count.variables.find(blocking)?.key : undefined;
  return slot ? { ready: false, reason: blocker, slot } : { ready: false, reason: blocker };
}

export function listContextOf(fields: ChannelFields, choices: Record<string, VariableChoice>): ListContext {
  const variables = audienceVariablesOf(choices);
  return variables.length > 0 ? { ...fields, variables } : { ...fields };
}
