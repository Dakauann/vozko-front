import { canTest } from "./ab-test";
import { isArchived, isRemoved } from "./delivery";
import { isEditableDraft, publishedIds, type TableRow } from "./manager-drafts";
import type { AdLevel } from "./types";

export const MAX_BULK_OBJECTS = 50;

export interface ToolbarPermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canStart: boolean;
  canStop: boolean;
}

export interface ToolbarContext {
  level: AdLevel;
  selected: TableRow[];
  permissions: ToolbarPermissions;
  manageBlocked: boolean;
  spendBlocked: boolean;
}

export type ActionBlocker =
  | "permission"
  | "account"
  | "funding"
  | "selectSome"
  | "selectOne"
  | "noDrafts"
  | "publishedOnly"
  | "publishing"
  | "draftRoot"
  | "archived"
  | "tooMany"
  | "testCount"
  | "level";

export type ActionState = { enabled: true } | { enabled: false; reason: ActionBlocker };

const READY: ActionState = { enabled: true };

const HIDDEN_BLOCKERS: ActionBlocker[] = ["permission", "publishedOnly", "level", "noDrafts"];

export function isOffered(state: ActionState): boolean {
  return state.enabled || !HIDDEN_BLOCKERS.includes(state.reason);
}

function blocked(reason: ActionBlocker): ActionState {
  return { enabled: false, reason };
}

function firstBlocker(checks: [boolean, ActionBlocker][]): ActionState {
  const failed = checks.find(([fails]) => fails);
  return failed ? blocked(failed[1]) : READY;
}

function hasDraft(rows: TableRow[]): boolean {
  return rows.some((row) => row.draft !== null);
}

function draftEditable(row: TableRow): boolean {
  return row.draft !== null && isEditableDraft(row.draft.state);
}

export function forRow(context: ToolbarContext, row: TableRow): ToolbarContext {
  return { ...context, level: row.level, selected: [row] };
}

export function createState({ permissions }: ToolbarContext): ActionState {
  return permissions.canCreate ? READY : blocked("permission");
}

export function publishState({ selected, permissions, manageBlocked }: ToolbarContext): ActionState {
  const drafts = selected.filter((row) => row.draft !== null);
  return firstBlocker([
    [drafts.length === 0, "noDrafts"],
    [!permissions.canCreate, "permission"],
    [manageBlocked, "account"],
    [!drafts.some(draftEditable), "publishing"],
  ]);
}

export function duplicateState({ selected, permissions, manageBlocked }: ToolbarContext): ActionState {
  const [row] = selected;
  if (selected.length === 1 && row.draft) {
    return firstBlocker([
      [!row.draft.root, "draftRoot"],
      [!permissions.canCreate, "permission"],
    ]);
  }
  return firstBlocker([
    [selected.length !== 1, "selectOne"],
    [!permissions.canCreate, "permission"],
    [manageBlocked, "account"],
    [!!row && isRemoved(row), "archived"],
  ]);
}

export function editState(context: ToolbarContext): ActionState {
  const { selected, permissions, manageBlocked } = context;
  const [row] = selected;
  if (selected.length === 0) return blocked("selectSome");
  if (selected.length > 1) {
    if (new Set(selected.map((candidate) => candidate.level)).size > 1) return blocked("level");
    return bulkEditState(context);
  }
  if (row.draft) {
    return firstBlocker([
      [!permissions.canCreate, "permission"],
      [!draftEditable(row), "publishing"],
    ]);
  }
  return firstBlocker([
    [!permissions.canUpdate, "permission"],
    [manageBlocked, "account"],
    [isArchived(row), "archived"],
  ]);
}

export function bulkEditState({ selected, permissions, manageBlocked }: ToolbarContext): ActionState {
  return firstBlocker([
    [selected.length === 0, "selectSome"],
    [hasDraft(selected), "publishedOnly"],
    [!permissions.canUpdate, "permission"],
    [manageBlocked, "account"],
    [selected.length > MAX_BULK_OBJECTS, "tooMany"],
    [selected.some(isArchived), "archived"],
  ]);
}

export function switchState({ selected, permissions, manageBlocked, spendBlocked }: ToolbarContext, on: boolean): ActionState {
  return firstBlocker([
    [selected.length === 0, "selectSome"],
    [hasDraft(selected), "publishedOnly"],
    [on ? !permissions.canStart : !permissions.canStop, "permission"],
    [manageBlocked, "account"],
    [on && spendBlocked, "funding"],
    [selected.length > MAX_BULK_OBJECTS, "tooMany"],
    [selected.some((row) => !row.canToggle), "archived"],
  ]);
}

export function deleteState({ selected, permissions, manageBlocked }: ToolbarContext): ActionState {
  if (selected.length === 0) return blocked("selectSome");
  for (const row of selected) {
    const state = row.draft
      ? firstBlocker([
          [!permissions.canCreate, "permission"],
          [!draftEditable(row), "publishing"],
        ])
      : firstBlocker([
          [!permissions.canDelete, "permission"],
          [manageBlocked, "account"],
          [isRemoved(row), "archived"],
        ]);
    if (!state.enabled) return state;
  }
  return READY;
}

export function abTestState({ level, selected, permissions, manageBlocked }: ToolbarContext): ActionState {
  return firstBlocker([
    [level === "ad", "level"],
    [hasDraft(selected), "publishedOnly"],
    [!permissions.canCreate, "permission"],
    [manageBlocked, "account"],
    [!canTest(selected.length), "testCount"],
  ]);
}

export type TabLabel = { kind: "plain" } | { kind: "forCampaigns"; count: number } | { kind: "forAdSets"; count: number };

export function tabLabel(level: AdLevel, campaigns: number, adSets: number): TabLabel {
  if (level === "ad" && adSets > 0) return { kind: "forAdSets", count: adSets };
  if (level !== "campaign" && campaigns > 0) return { kind: "forCampaigns", count: campaigns };
  return { kind: "plain" };
}

export function archiveState({ selected, permissions, manageBlocked }: ToolbarContext): ActionState {
  return firstBlocker([
    [selected.length !== 1, "selectOne"],
    [hasDraft(selected), "publishedOnly"],
    [!permissions.canUpdate, "permission"],
    [manageBlocked, "account"],
    [selected.some(isArchived), "archived"],
  ]);
}

export function addChildState({ selected, permissions, manageBlocked }: ToolbarContext): ActionState {
  const [row] = selected;
  return firstBlocker([
    [selected.length !== 1, "selectOne"],
    [!!row && row.level === "ad", "level"],
    [hasDraft(selected), "publishedOnly"],
    [!permissions.canCreate, "permission"],
    [manageBlocked, "account"],
    [!!row && isArchived(row), "archived"],
  ]);
}

export type LevelSelection = Record<AdLevel, ReadonlySet<string>>;

export const EMPTY_SELECTION: LevelSelection = { campaign: new Set(), adset: new Set(), ad: new Set() };

export function selectAt(selection: LevelSelection, level: AdLevel, keys: ReadonlySet<string>): LevelSelection {
  if (level === "campaign") return { campaign: keys, adset: new Set(), ad: new Set() };
  if (level === "adset") return { ...selection, adset: keys, ad: new Set() };
  return { ...selection, ad: keys };
}

export function createParentFor(level: AdLevel, selection: LevelSelection): { campaignId?: string; adSetId?: string } | undefined {
  const only = (keys: ReadonlySet<string>) => {
    const ids = publishedIds(keys);
    return keys.size === 1 && ids.length === 1 ? ids[0] : null;
  };
  if (level === "ad") {
    const adSetId = only(selection.adset);
    if (adSetId) return { adSetId };
  }
  if (level !== "campaign") {
    const campaignId = only(selection.campaign);
    if (campaignId) return { campaignId };
  }
  return undefined;
}
