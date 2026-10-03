import { describe, expect, it } from "vitest";

import {
  draftIdsOf,
  draftRemovals,
  draftRowState,
  draftTableRows,
  hasPublishing,
  isDraftKey,
  isEditableDraft,
  isRenamable,
  parseDraftKey,
  publishedIds,
  publishedScope,
  draftTone,
  renameDraftNode,
  type DraftScope,
} from "./manager-drafts";
import { fixtureContent, fixtureDraft } from "./manager-test-fixtures";

const noScope: DraftScope = { campaigns: new Set(), adSets: new Set(), adSetCampaigns: new Map() };

describe("draft keys", () => {
  it("reads the draft id before the first colon and the node after it", () => {
    expect(parseDraftKey("d1:campaign")).toEqual({ draftId: "d1", node: { kind: "campaign" } });
    expect(parseDraftKey("d1:adset")).toEqual({ draftId: "d1", node: { kind: "adset" } });
    expect(parseDraftKey("d1:ad:2")).toEqual({ draftId: "d1", node: { kind: "ad", index: 2 } });
  });

  it("refuses anything that is not a draft row key", () => {
    expect(parseDraftKey("120210000000")).toBeNull();
    expect(parseDraftKey(":campaign")).toBeNull();
    expect(parseDraftKey("d1:ad:x")).toBeNull();
    expect(parseDraftKey("d1:ad:-1")).toBeNull();
    expect(parseDraftKey("d1:other")).toBeNull();
    expect(isDraftKey("d1:adset")).toBe(true);
    expect(isDraftKey("120210000000")).toBe(false);
  });

  it("splits a selection into published ids and draft ids", () => {
    const keys = ["200", "d2:ad:0", "100", "d1:campaign", "d1:adset"];
    expect(publishedIds(keys)).toEqual(["100", "200"]);
    expect(draftIdsOf(keys)).toEqual(["d1", "d2"]);
  });
});

describe("draft state", () => {
  it("only lets editing and failed drafts change", () => {
    expect(draftRowState("editing")).toBe("editing");
    expect(draftRowState("failed")).toBe("failed");
    expect(draftRowState("publishing")).toBe("publishing");
    expect(draftRowState("archived")).toBe("unknown");
    expect(isEditableDraft("editing")).toBe(true);
    expect(isEditableDraft("failed")).toBe(true);
    expect(isEditableDraft("publishing")).toBe(false);
    expect(isEditableDraft("unknown")).toBe(false);
  });

  it("knows when a draft is still publishing", () => {
    expect(hasPublishing([fixtureDraft(), fixtureDraft({ id: "d2", state: "publishing" })])).toBe(true);
    expect(hasPublishing([fixtureDraft()])).toBe(false);
  });
});

describe("draftTableRows", () => {
  it("projects each level of a draft into rows without metrics or a working switch", () => {
    const [campaign] = draftTableRows([fixtureDraft()], "campaign", noScope, "BRL");
    expect(campaign.metaId).toBe("d1:campaign");
    expect(campaign.name).toBe("Nova campanha de Leads");
    expect(campaign.dailyBudget).toBe(2000);
    expect(campaign.lifetimeBudget).toBe(0);
    expect(campaign.canToggle).toBe(false);
    expect(campaign.isOn).toBe(false);
    expect(campaign.metrics.impressions).toBe(0);
    expect(campaign.draft).toEqual({ draftId: "d1", key: "d1:campaign", root: true, state: "editing", error: null });
    expect(draftTableRows([fixtureDraft()], "ad", noScope, "BRL").map((row) => row.metaId)).toEqual(["d1:ad:0", "d1:ad:1"]);
  });

  it("carries the job error only for a failed draft", () => {
    const job = {
      id: "j1",
      adAccountId: "a1",
      campaignName: "x",
      status: "FAILED",
      progress: {},
      fee: "0",
      errorMessage: "Página sem permissão",
      createdAt: "",
      updatedAt: "",
    };
    expect(draftTableRows([fixtureDraft({ state: "failed", job })], "campaign", noScope, "BRL")[0].draft?.error).toBe("Página sem permissão");
    expect(draftTableRows([fixtureDraft({ state: "editing", job })], "campaign", noScope, "BRL")[0].draft?.error).toBeNull();
  });

  it("keeps a draft ad set under the existing campaign it belongs to", () => {
    const draft = fixtureDraft({
      id: "d2",
      rows: [
        { key: "d2:adset", level: "adset", name: "Conjunto novo", parentMetaId: "500" },
        { key: "d2:ad:0", level: "ad", name: "Anúncio novo", parentKey: "d2:adset" },
      ],
    });
    const scope = (campaigns: string[]): DraftScope => ({ ...noScope, campaigns: new Set(campaigns) });
    expect(draftTableRows([draft], "adset", scope(["500"]), "BRL").map((row) => row.metaId)).toEqual(["d2:adset"]);
    expect(draftTableRows([draft], "adset", scope(["600"]), "BRL")).toEqual([]);
    expect(draftTableRows([draft], "ad", scope(["500"]), "BRL").map((row) => row.metaId)).toEqual(["d2:ad:0"]);
    expect(draftTableRows([draft], "adset", noScope, "BRL").map((row) => row.campaignId)).toEqual(["500"]);
  });

  it("filters draft rows by selected draft parents too", () => {
    const scope: DraftScope = { ...noScope, campaigns: new Set(["d1:campaign"]) };
    expect(draftTableRows([fixtureDraft(), fixtureDraft({ id: "d9" })], "adset", scope, "BRL").map((row) => row.metaId)).toEqual(["d1:adset"]);
    const adSets: DraftScope = { ...noScope, campaigns: new Set(["d1:campaign"]), adSets: new Set(["d1:adset"]) };
    expect(draftTableRows([fixtureDraft()], "ad", adSets, "BRL").map((row) => row.metaId)).toEqual(["d1:ad:0", "d1:ad:1"]);
  });

  it("finds the campaign of a draft ad placed in an existing ad set", () => {
    const draft = fixtureDraft({ id: "d3", rows: [{ key: "d3:ad:0", level: "ad", name: "Anúncio", parentMetaId: "700" }] });
    const scope: DraftScope = { campaigns: new Set(["500"]), adSets: new Set(), adSetCampaigns: new Map([["700", "500"]]) };
    expect(draftTableRows([draft], "ad", scope, "BRL").map((row) => row.metaId)).toEqual(["d3:ad:0"]);
    expect(draftTableRows([draft], "ad", { ...scope, adSetCampaigns: new Map() }, "BRL")).toEqual([]);
    expect(draftTableRows([draft], "ad", noScope, "BRL")[0].adSetId).toBe("700");
  });
});

describe("renameDraftNode", () => {
  it("renames the campaign, the ad set or one ad of the tree", () => {
    const content = fixtureContent();
    expect(renameDraftNode(content, { kind: "campaign" }, " Black Friday ")?.campaign.name).toBe("Black Friday");
    expect(renameDraftNode(content, { kind: "adset" }, "Conjunto A")?.adSet.name).toBe("Conjunto A");
    const renamed = renameDraftNode(content, { kind: "ad", index: 1 }, "Anúncio B");
    expect(renamed?.ads.map((ad) => ad.name)).toEqual(["Novo anúncio de Leads", "Anúncio B"]);
    expect(content.ads[1].name).toBe("Segundo anúncio");
  });

  it("refuses a blank name, a missing ad and a parent that already exists in Meta", () => {
    const content = fixtureContent();
    expect(renameDraftNode(content, { kind: "campaign" }, "  ")).toBeNull();
    expect(renameDraftNode(content, { kind: "ad", index: 5 }, "x")).toBeNull();
    expect(renameDraftNode(fixtureContent({ campaign: { existingId: "500" } }), { kind: "campaign" }, "x")).toBeNull();
    const existingAdSet = fixtureContent();
    existingAdSet.adSet.existingId = "700";
    expect(renameDraftNode(existingAdSet, { kind: "adset" }, "x")).toBeNull();
  });

  it("tells whether a node can be renamed before anything is typed", () => {
    expect(isRenamable(fixtureContent(), { kind: "campaign" })).toBe(true);
    expect(isRenamable(fixtureContent({ campaign: { existingId: "500" } }), { kind: "campaign" })).toBe(false);
    expect(isRenamable(fixtureContent(), { kind: "ad", index: 2 })).toBe(false);
  });
});

describe("draftRemovals", () => {
  it("removes the whole draft when its campaign or ad set row is chosen", () => {
    expect(draftRemovals([fixtureDraft()], ["d1:campaign"])).toEqual([{ kind: "draft", draftId: "d1" }]);
    expect(draftRemovals([fixtureDraft()], ["d1:adset", "d1:ad:0"])).toEqual([{ kind: "draft", draftId: "d1" }]);
  });

  it("removes the whole draft when every ad is chosen", () => {
    expect(draftRemovals([fixtureDraft()], ["d1:ad:0", "d1:ad:1"])).toEqual([{ kind: "draft", draftId: "d1" }]);
  });

  it("keeps the rest of the tree when only some ads are chosen", () => {
    const [removal] = draftRemovals([fixtureDraft({ version: 4 })], ["d1:ad:0"]);
    expect(removal.kind).toBe("ads");
    if (removal.kind !== "ads") return;
    expect(removal.version).toBe(4);
    expect(removal.content.ads.map((ad) => ad.name)).toEqual(["Segundo anúncio"]);
  });

  it("ignores published ids and drafts that are not loaded", () => {
    expect(draftRemovals([fixtureDraft()], ["100", "d7:campaign"])).toEqual([]);
  });
});

describe("publishedScope", () => {
  it("sends only published ids to the report", () => {
    expect(publishedScope(new Set(["d1:campaign", "500"]), new Set(["700"]))).toEqual({
      campaignIds: ["500"],
      adSetIds: ["700"],
      adSetsOutOfScope: false,
      adsOutOfScope: false,
    });
  });

  it("shows no published rows below a selection made only of drafts, instead of every row", () => {
    expect(publishedScope(new Set(["d1:campaign"]), new Set())).toMatchObject({ campaignIds: [], adSetsOutOfScope: true, adsOutOfScope: true });
    expect(publishedScope(new Set(["500"]), new Set(["d1:adset"]))).toMatchObject({ adSetsOutOfScope: false, adsOutOfScope: true });
    expect(publishedScope(new Set(), new Set())).toMatchObject({ adSetsOutOfScope: false, adsOutOfScope: false });
  });
});

describe("draftTone", () => {
  it("greys an editing draft, marks publishing as info and a failure as a fault", () => {
    expect(draftTone("editing")).toBe("neutral");
    expect(draftTone("publishing")).toBe("info");
    expect(draftTone("failed")).toBe("fault");
    expect(draftTone("unknown")).toBe("neutral");
  });
});
