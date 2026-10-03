import type { DeliveryTone } from "./delivery";
import type { MetaAdDraft } from "./draft-types";
import type { ManagerRow } from "./live";
import type { AdDraftRow, AdDraftState, AdLevel, AdMetrics, AdOutcome, AdSavedDraft } from "./types";

export type DraftRowState = AdDraftState | "unknown";

export interface DraftMark {
  draftId: string;
  key: string;
  root: boolean;
  state: DraftRowState;
  error: string | null;
}

export type TableRow = ManagerRow & { draft: DraftMark | null };

export type DraftNode = { kind: "campaign" } | { kind: "adset" } | { kind: "ad"; index: number };

export interface DraftScope {
  campaigns: ReadonlySet<string>;
  adSets: ReadonlySet<string>;
  adSetCampaigns: ReadonlyMap<string, string>;
}

export type DraftRemoval = { kind: "draft"; draftId: string } | { kind: "ads"; draftId: string; content: MetaAdDraft; version: number };

const AD_INDEX = /^\d+$/;

export function parseDraftKey(key: string): { draftId: string; node: DraftNode } | null {
  const [draftId, kind, index, ...rest] = key.split(":");
  if (!draftId || rest.length > 0) return null;
  if (kind === "campaign" && index === undefined) return { draftId, node: { kind: "campaign" } };
  if (kind === "adset" && index === undefined) return { draftId, node: { kind: "adset" } };
  if (kind === "ad" && index !== undefined && AD_INDEX.test(index)) return { draftId, node: { kind: "ad", index: Number(index) } };
  return null;
}

export function isDraftKey(key: string): boolean {
  return parseDraftKey(key) !== null;
}

export function publishedIds(keys: Iterable<string>): string[] {
  return Array.from(keys)
    .filter((key) => !isDraftKey(key))
    .sort();
}

export function draftIdsOf(keys: Iterable<string>): string[] {
  const ids = new Set<string>();
  for (const key of keys) {
    const parsed = parseDraftKey(key);
    if (parsed) ids.add(parsed.draftId);
  }
  return Array.from(ids).sort();
}

export function draftRowState(state: string): DraftRowState {
  return state === "editing" || state === "publishing" || state === "failed" ? state : "unknown";
}

export function isEditableDraft(state: DraftRowState): boolean {
  return state === "editing" || state === "failed";
}

export function hasPublishing(drafts: AdSavedDraft[]): boolean {
  return drafts.some((draft) => draftRowState(draft.state) === "publishing");
}

export function asTableRow(row: ManagerRow): TableRow {
  return { ...row, draft: null };
}

function emptyMetrics(currency: string): AdMetrics {
  return {
    currency,
    spend: 0,
    impressions: 0,
    clicks: 0,
    linkClicks: 0,
    results: 0,
    resultAction: "",
    mixedResults: false,
    costPerResult: null,
    conversations: 0,
    costPerConversation: null,
    cpc: null,
    cpm: null,
    ctr: null,
  };
}

const EMPTY_OUTCOME: AdOutcome = {
  conversations: 0,
  leads: 0,
  wonDeals: 0,
  revenue: 0,
  costPerConversation: null,
  costPerLead: null,
  roas: null,
};

function ancestorsOf(draft: AdSavedDraft, row: AdDraftRow, adSetCampaigns: ReadonlyMap<string, string>): Set<string> {
  const byKey = new Map(draft.rows.map((candidate) => [candidate.key, candidate]));
  const found = new Set<string>();
  let current: AdDraftRow | undefined = row;
  while (current) {
    if (current.parentMetaId) {
      found.add(current.parentMetaId);
      const campaign = adSetCampaigns.get(current.parentMetaId);
      if (campaign) found.add(campaign);
    }
    const parentKey: string | undefined = current.parentKey;
    if (!parentKey || found.has(parentKey)) break;
    found.add(parentKey);
    current = byKey.get(parentKey);
  }
  return found;
}

function overlaps(ancestors: Set<string>, selected: ReadonlySet<string>): boolean {
  for (const key of selected) if (ancestors.has(key)) return true;
  return false;
}

function inScope(ancestors: Set<string>, level: AdLevel, scope: DraftScope): boolean {
  if (level === "campaign") return true;
  if (level === "ad" && scope.adSets.size > 0) return overlaps(ancestors, scope.adSets);
  if (scope.campaigns.size > 0) return overlaps(ancestors, scope.campaigns);
  return true;
}

function projectRow(draft: AdSavedDraft, row: AdDraftRow, currency: string): TableRow {
  const state = draftRowState(draft.state);
  const budget = row.budget;
  return {
    metaId: row.key,
    level: row.level,
    name: row.name,
    campaignId: row.level === "adset" ? row.parentMetaId : undefined,
    adSetId: row.level === "ad" ? row.parentMetaId : undefined,
    status: "DRAFT",
    effectiveStatus: "DRAFT",
    delivery: "unknown",
    isOn: false,
    canToggle: false,
    objective: row.objective,
    optimizationGoal: row.goal,
    destinationType: row.destination,
    dailyBudget: budget?.kind === "DAILY" ? budget.amount : 0,
    lifetimeBudget: budget?.kind === "LIFETIME" ? budget.amount : 0,
    issues: null,
    metrics: emptyMetrics(currency),
    outcome: EMPTY_OUTCOME,
    live: null,
    draft: {
      draftId: draft.id,
      key: row.key,
      root: row.key === draft.rows[0]?.key,
      state,
      error: state === "failed" ? (draft.job?.errorMessage ?? null) : null,
    },
  };
}

export function draftTableRows(drafts: AdSavedDraft[], level: AdLevel, scope: DraftScope, currency: string): TableRow[] {
  return drafts.flatMap((draft) =>
    draft.rows
      .filter((row) => row.level === level && inScope(ancestorsOf(draft, row, scope.adSetCampaigns), level, scope))
      .map((row) => projectRow(draft, row, currency)),
  );
}

export function isRenamable(content: MetaAdDraft, node: DraftNode): boolean {
  switch (node.kind) {
    case "campaign":
      return !content.campaign.existingId;
    case "adset":
      return !content.adSet.existingId;
    case "ad":
      return node.index < content.ads.length;
  }
}

export function renameDraftNode(content: MetaAdDraft, node: DraftNode, name: string): MetaAdDraft | null {
  const trimmed = name.trim();
  if (!trimmed || !isRenamable(content, node)) return null;
  switch (node.kind) {
    case "campaign":
      return { ...content, campaign: { ...content.campaign, name: trimmed } };
    case "adset":
      return { ...content, adSet: { ...content.adSet, name: trimmed } };
    case "ad":
      return { ...content, ads: content.ads.map((ad, index) => (index === node.index ? { ...ad, name: trimmed } : ad)) };
  }
}

export function draftRemovals(drafts: AdSavedDraft[], keys: Iterable<string>): DraftRemoval[] {
  const nodes = new Map<string, DraftNode[]>();
  for (const key of keys) {
    const parsed = parseDraftKey(key);
    if (parsed) nodes.set(parsed.draftId, [...(nodes.get(parsed.draftId) ?? []), parsed.node]);
  }
  return drafts.flatMap<DraftRemoval>((draft) => {
    const chosen = nodes.get(draft.id);
    if (!chosen) return [];
    if (chosen.some((node) => node.kind !== "ad")) return [{ kind: "draft", draftId: draft.id }];
    const indices = new Set(chosen.map((node) => (node.kind === "ad" ? node.index : -1)));
    const remaining = draft.draft.ads.filter((_, index) => !indices.has(index));
    if (remaining.length === 0) return [{ kind: "draft", draftId: draft.id }];
    return [{ kind: "ads", draftId: draft.id, content: { ...draft.draft, ads: remaining }, version: draft.version }];
  });
}

export interface PublishedScope {
  campaignIds: string[];
  adSetIds: string[];
  adSetsOutOfScope: boolean;
  adsOutOfScope: boolean;
}

export function publishedScope(campaigns: ReadonlySet<string>, adSets: ReadonlySet<string>): PublishedScope {
  const campaignIds = publishedIds(campaigns);
  const adSetIds = publishedIds(adSets);
  const adSetsOutOfScope = campaigns.size > 0 && campaignIds.length === 0;
  return { campaignIds, adSetIds, adSetsOutOfScope, adsOutOfScope: adSetsOutOfScope || (adSets.size > 0 && adSetIds.length === 0) };
}

export function draftTone(state: DraftRowState): DeliveryTone {
  switch (state) {
    case "publishing":
      return "info";
    case "failed":
      return "fault";
    default:
      return "neutral";
  }
}
