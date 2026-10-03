import { describe, expect, it } from "vitest";

import { asTableRow, draftTableRows, type TableRow } from "./manager-drafts";
import {
  EMPTY_SELECTION,
  MAX_BULK_OBJECTS,
  createParentFor,
  selectAt,
  addChildState,
  archiveState,
  abTestState,
  bulkEditState,
  createState,
  deleteState,
  duplicateState,
  editState,
  forRow,
  isOffered,
  publishState,
  switchState,
  tabLabel,
  type ToolbarContext,
} from "./manager-toolbar";
import { fixtureDraft, fixtureRow } from "./manager-test-fixtures";

const allowed = { canCreate: true, canUpdate: true, canDelete: true, canStart: true, canStop: true };
const noScope = { campaigns: new Set<string>(), adSets: new Set<string>(), adSetCampaigns: new Map<string, string>() };

const published = (overrides: Parameters<typeof fixtureRow>[0] = {}) => asTableRow(fixtureRow(overrides));
const draft = (state: "editing" | "failed" | "publishing" = "editing") =>
  draftTableRows([fixtureDraft({ state })], "campaign", noScope, "BRL")[0];

const context = (selected: TableRow[], overrides: Partial<ToolbarContext> = {}): ToolbarContext => ({
  level: "campaign",
  selected,
  permissions: allowed,
  manageBlocked: false,
  spendBlocked: false,
  ...overrides,
});

describe("createState", () => {
  it("needs only the create permission, since building drafts is never blocked by the account", () => {
    expect(createState(context([], { manageBlocked: true }))).toEqual({ enabled: true });
    expect(createState(context([], { permissions: { ...allowed, canCreate: false } }))).toEqual({ enabled: false, reason: "permission" });
  });
});

describe("publishState", () => {
  it("needs a draft in the selection that is not already publishing", () => {
    expect(publishState(context([published()]))).toEqual({ enabled: false, reason: "noDrafts" });
    expect(publishState(context([draft("publishing")]))).toEqual({ enabled: false, reason: "publishing" });
    expect(publishState(context([draft(), published()]))).toEqual({ enabled: true });
    expect(publishState(context([draft("failed")]))).toEqual({ enabled: true });
  });

  it("fails closed on permission and on an account that cannot be changed", () => {
    expect(publishState(context([draft()], { permissions: { ...allowed, canCreate: false } }))).toEqual({ enabled: false, reason: "permission" });
    expect(publishState(context([draft()], { manageBlocked: true }))).toEqual({ enabled: false, reason: "account" });
  });
});

describe("duplicateState", () => {
  it("duplicates a whole draft from its top row, even while it publishes", () => {
    const rows = draftTableRows([fixtureDraft()], "ad", noScope, "BRL");
    expect(duplicateState(context([draft()]))).toEqual({ enabled: true });
    expect(duplicateState(context([draft("publishing")]))).toEqual({ enabled: true });
    expect(duplicateState(context([rows[0]], { level: "ad" }))).toEqual({ enabled: false, reason: "draftRoot" });
    expect(duplicateState(context([draft()], { permissions: { ...allowed, canCreate: false } }))).toEqual({ enabled: false, reason: "permission" });
  });

  it("duplicates exactly one live object", () => {
    expect(duplicateState(context([]))).toEqual({ enabled: false, reason: "selectOne" });
    expect(duplicateState(context([published(), published({ metaId: "2" })]))).toEqual({ enabled: false, reason: "selectOne" });
    expect(duplicateState(context([published({ status: "DELETED" })]))).toEqual({ enabled: false, reason: "archived" });
    expect(duplicateState(context([published()], { manageBlocked: true }))).toEqual({ enabled: false, reason: "account" });
    expect(duplicateState(context([published()]))).toEqual({ enabled: true });
  });
});

describe("editState", () => {
  it("opens the editor for one row, a draft with create and a live object with update", () => {
    expect(editState(context([]))).toEqual({ enabled: false, reason: "selectSome" });
    expect(editState(context([draft()], { permissions: { ...allowed, canUpdate: false } }))).toEqual({ enabled: true });
    expect(editState(context([draft("publishing")]))).toEqual({ enabled: false, reason: "publishing" });
    expect(editState(context([published()], { permissions: { ...allowed, canUpdate: false } }))).toEqual({ enabled: false, reason: "permission" });
    expect(editState(context([published({ status: "ARCHIVED" })]))).toEqual({ enabled: false, reason: "archived" });
    expect(editState(context([published()]))).toEqual({ enabled: true });
  });

  it("opens the multi editor for several live objects of one level, under the bulk rules", () => {
    const two = [published(), published({ metaId: "2" })];
    expect(editState(context(two))).toEqual({ enabled: true });
    expect(editState(context([published(), draft()]))).toEqual({ enabled: false, reason: "publishedOnly" });
    expect(editState(context([published(), published({ metaId: "2", level: "adset" })]))).toEqual({ enabled: false, reason: "level" });
    expect(editState(context(two, { permissions: { ...allowed, canUpdate: false } }))).toEqual({ enabled: false, reason: "permission" });
    expect(editState(context(two, { manageBlocked: true }))).toEqual({ enabled: false, reason: "account" });
    expect(editState(context([published(), published({ metaId: "2", status: "ARCHIVED" })]))).toEqual({ enabled: false, reason: "archived" });
    const many = Array.from({ length: MAX_BULK_OBJECTS + 1 }, (_, index) => published({ metaId: String(index) }));
    expect(editState(context(many))).toEqual({ enabled: false, reason: "tooMany" });
  });
});

describe("bulkEditState", () => {
  it("edits live objects only, up to the batch size", () => {
    expect(bulkEditState(context([]))).toEqual({ enabled: false, reason: "selectSome" });
    expect(bulkEditState(context([published(), draft()]))).toEqual({ enabled: false, reason: "publishedOnly" });
    const many = Array.from({ length: MAX_BULK_OBJECTS + 1 }, (_, index) => published({ metaId: String(index) }));
    expect(bulkEditState(context(many))).toEqual({ enabled: false, reason: "tooMany" });
    expect(bulkEditState(context([published()], { manageBlocked: true }))).toEqual({ enabled: false, reason: "account" });
    expect(bulkEditState(context([published(), published({ metaId: "2" })]))).toEqual({ enabled: true });
  });
});

describe("switchState", () => {
  it("turns on only with the start permission and a funded account", () => {
    expect(switchState(context([published()], { permissions: { ...allowed, canStart: false } }), true)).toEqual({ enabled: false, reason: "permission" });
    expect(switchState(context([published()], { spendBlocked: true }), true)).toEqual({ enabled: false, reason: "funding" });
    expect(switchState(context([published()], { spendBlocked: true }), false)).toEqual({ enabled: true });
  });

  it("refuses drafts and locked objects", () => {
    expect(switchState(context([draft()]), false)).toEqual({ enabled: false, reason: "publishedOnly" });
    expect(switchState(context([published({ canToggle: false })]), true)).toEqual({ enabled: false, reason: "archived" });
  });
});

describe("deleteState", () => {
  it("checks every selected row and fails on the first one that cannot go", () => {
    expect(deleteState(context([]))).toEqual({ enabled: false, reason: "selectSome" });
    expect(deleteState(context([draft(), published()]))).toEqual({ enabled: true });
    expect(deleteState(context([draft(), published()], { permissions: { ...allowed, canDelete: false } }))).toEqual({ enabled: false, reason: "permission" });
    expect(deleteState(context([draft()], { permissions: { ...allowed, canDelete: false } }))).toEqual({ enabled: true });
    expect(deleteState(context([draft("publishing")]))).toEqual({ enabled: false, reason: "publishing" });
    expect(deleteState(context([published({ effectiveStatus: "DELETED" })]))).toEqual({ enabled: false, reason: "archived" });
  });
});

describe("abTestState", () => {
  it("compares two to five live campaigns or ad sets", () => {
    const two = [published(), published({ metaId: "2" })];
    expect(abTestState(context(two))).toEqual({ enabled: true });
    expect(abTestState(context([published()]))).toEqual({ enabled: false, reason: "testCount" });
    expect(abTestState(context([published(), draft()]))).toEqual({ enabled: false, reason: "publishedOnly" });
    expect(abTestState(context(two, { level: "ad" }))).toEqual({ enabled: false, reason: "level" });
    expect(abTestState(context(two, { manageBlocked: true }))).toEqual({ enabled: false, reason: "account" });
  });
});

describe("tabLabel", () => {
  it("renames the next tabs after the selection", () => {
    expect(tabLabel("campaign", 2, 0)).toEqual({ kind: "plain" });
    expect(tabLabel("adset", 2, 0)).toEqual({ kind: "forCampaigns", count: 2 });
    expect(tabLabel("adset", 0, 3)).toEqual({ kind: "plain" });
    expect(tabLabel("ad", 2, 3)).toEqual({ kind: "forAdSets", count: 3 });
    expect(tabLabel("ad", 2, 0)).toEqual({ kind: "forCampaigns", count: 2 });
  });
});

describe("archiveState", () => {
  it("archives one live object that is not archived yet", () => {
    expect(archiveState(context([published()]))).toEqual({ enabled: true });
    expect(archiveState(context([published({ status: "ARCHIVED" })]))).toEqual({ enabled: false, reason: "archived" });
    expect(archiveState(context([draft()]))).toEqual({ enabled: false, reason: "publishedOnly" });
    expect(archiveState(context([published()], { permissions: { ...allowed, canUpdate: false } }))).toEqual({ enabled: false, reason: "permission" });
  });
});

describe("addChildState", () => {
  it("adds an ad set to a live campaign or an ad to a live ad set", () => {
    expect(addChildState(context([published()]))).toEqual({ enabled: true });
    expect(addChildState(context([published({ level: "ad" })]))).toEqual({ enabled: false, reason: "level" });
    expect(addChildState(context([draft()]))).toEqual({ enabled: false, reason: "publishedOnly" });
    expect(addChildState(context([published()], { manageBlocked: true }))).toEqual({ enabled: false, reason: "account" });
  });
});

describe("selectAt", () => {
  it("clears the levels below when the selection above changes, so stale filters never linger", () => {
    const start = { campaign: new Set(["1"]), adset: new Set(["2"]), ad: new Set(["3"]) };
    expect(selectAt(start, "campaign", new Set(["9"]))).toEqual({ campaign: new Set(["9"]), adset: new Set(), ad: new Set() });
    expect(selectAt(start, "adset", new Set(["8"]))).toEqual({ campaign: new Set(["1"]), adset: new Set(["8"]), ad: new Set() });
    expect(selectAt(start, "ad", new Set())).toEqual({ campaign: new Set(["1"]), adset: new Set(["2"]), ad: new Set() });
    expect(EMPTY_SELECTION.campaign.size).toBe(0);
  });
});

describe("createParentFor", () => {
  it("offers the one selected live parent to the create dialog", () => {
    const selection = { campaign: new Set(["500"]), adset: new Set(["700"]), ad: new Set<string>() };
    expect(createParentFor("ad", selection)).toEqual({ adSetId: "700" });
    expect(createParentFor("adset", selection)).toEqual({ campaignId: "500" });
    expect(createParentFor("campaign", selection)).toBeUndefined();
  });

  it("offers nothing for several parents or a draft parent", () => {
    expect(createParentFor("adset", { campaign: new Set(["500", "501"]), adset: new Set(), ad: new Set() })).toBeUndefined();
    expect(createParentFor("adset", { campaign: new Set(["d1:campaign"]), adset: new Set(), ad: new Set() })).toBeUndefined();
    expect(createParentFor("ad", { campaign: new Set(["500"]), adset: new Set(["d1:adset"]), ad: new Set() })).toEqual({ campaignId: "500" });
  });
});

describe("forRow", () => {
  it("narrows the context to one row at that row's level", () => {
    const row = published({ level: "ad" });
    expect(forRow(context([published(), published({ metaId: "2" })]), row)).toEqual({ ...context([]), level: "ad", selected: [row] });
  });
});

describe("isOffered", () => {
  it("hides actions the person can never use here and shows the rest with their reason", () => {
    expect(isOffered({ enabled: true })).toBe(true);
    expect(isOffered({ enabled: false, reason: "permission" })).toBe(false);
    expect(isOffered({ enabled: false, reason: "noDrafts" })).toBe(false);
    expect(isOffered({ enabled: false, reason: "account" })).toBe(true);
  });
});
