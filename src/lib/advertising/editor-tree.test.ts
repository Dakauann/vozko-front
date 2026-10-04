import { describe, expect, it } from "vitest";

import { emptyAdForm, emptyWizardForm, type WizardForm } from "./draft";
import {
  AD_SET_NODE,
  CAMPAIGN_NODE,
  adNode,
  canAddAdTo,
  editorNodes,
  fitNode,
  neighbourNode,
  nodeAfterRemoval,
  nodeHasIssues,
  nodeKey,
  nodeOfIssue,
  objectChain,
  objectOrder,
  objectTree,
  sameNode,
  startNode,
  withAdAdded,
  withAdDuplicated,
  withAdRemoved,
} from "./editor-tree";
import { MAX_ADS } from "./wizard-routes";
import type { AdLevel, AdRow } from "./types";

function formWith(ads: number, changes: Partial<WizardForm> = {}): WizardForm {
  return {
    ...emptyWizardForm("acc-1"),
    objective: "OUTCOME_LEADS",
    destination: "WHATSAPP",
    ads: Array.from({ length: ads }, (_, index) => ({ ...emptyAdForm(`a${index}`), name: `Anúncio ${index + 1}` })),
    ...changes,
  };
}

function row(metaId: string, level: AdLevel, parents: Partial<Pick<AdRow, "campaignId" | "adSetId">> = {}): AdRow {
  return { metaId, level, name: metaId, ...parents } as AdRow;
}

describe("editor nodes", () => {
  it("lists the campaign, the ad set and every ad in order", () => {
    expect(editorNodes(formWith(2))).toEqual([CAMPAIGN_NODE, AD_SET_NODE, adNode(0), adNode(1)]);
  });

  it("compares and keys nodes", () => {
    expect(sameNode(adNode(1), adNode(1))).toBe(true);
    expect(sameNode(adNode(1), adNode(0))).toBe(false);
    expect(sameNode(CAMPAIGN_NODE, AD_SET_NODE)).toBe(false);
    expect(nodeKey(adNode(3))).toBe("ad:3");
    expect(nodeKey(AD_SET_NODE)).toBe("adSet");
  });

  it("opens on the first level the person creates", () => {
    expect(startNode(formWith(1))).toEqual(CAMPAIGN_NODE);
    expect(startNode(formWith(1, { mode: "campaign" }))).toEqual(AD_SET_NODE);
    expect(startNode(formWith(1, { mode: "adSet" }))).toEqual(adNode(0));
  });

  it("moves back and forward through the levels", () => {
    const form = formWith(2);
    expect(neighbourNode(form, CAMPAIGN_NODE, -1)).toBeNull();
    expect(neighbourNode(form, CAMPAIGN_NODE, 1)).toEqual(AD_SET_NODE);
    expect(neighbourNode(form, AD_SET_NODE, 1)).toEqual(adNode(0));
    expect(neighbourNode(form, adNode(1), 1)).toBeNull();
    expect(neighbourNode(form, adNode(1), -1)).toEqual(adNode(0));
  });

  it("keeps a selected ad inside the list", () => {
    expect(fitNode(adNode(4), formWith(2))).toEqual(adNode(1));
    expect(fitNode(AD_SET_NODE, formWith(2))).toEqual(AD_SET_NODE);
  });

});

describe("issues in the tree", () => {
  it("maps each field to the node that shows it", () => {
    expect(nodeOfIssue("adAccountId")).toEqual(CAMPAIGN_NODE);
    expect(nodeOfIssue("campaign.budget.amount")).toEqual(CAMPAIGN_NODE);
    expect(nodeOfIssue("adSet.targeting.age")).toEqual(AD_SET_NODE);
    expect(nodeOfIssue("identity.pageId")).toEqual(adNode(0));
    expect(nodeOfIssue("ads[2].creative.media")).toEqual(adNode(2));
    expect(nodeOfIssue("ads")).toEqual(adNode(0));
    expect(nodeOfIssue("something")).toBeNull();
  });

  it("tells which nodes have issues", () => {
    const issues = [
      { field: "adSet.goal", code: "required" },
      { field: "ads[1].creative.link", code: "invalid_url" },
    ];
    expect(nodeHasIssues(issues, AD_SET_NODE)).toBe(true);
    expect(nodeHasIssues(issues, adNode(1))).toBe(true);
    expect(nodeHasIssues(issues, adNode(0))).toBe(false);
    expect(nodeHasIssues(issues, CAMPAIGN_NODE)).toBe(false);
  });
});

describe("ad operations", () => {
  it("adds an unnamed ad, which takes the campaign name, in a format the destination accepts", () => {
    const next = withAdAdded(formWith(1, { destination: "ON_POST" }));
    expect(next.ads).toHaveLength(2);
    expect(next.ads[1]).toMatchObject({ name: "", format: "EXISTING_POST" });
  });

  it("refuses to add past the Meta limit", () => {
    const full = formWith(MAX_ADS);
    expect(canAddAdTo(full)).toBe(false);
    expect(withAdAdded(full)).toBe(full);
    expect(canAddAdTo(formWith(1))).toBe(true);
  });

  it("refuses to add a second ad next to a flexible one", () => {
    const flexible = formWith(1);
    flexible.ads[0].format = "FLEXIBLE";
    expect(canAddAdTo(flexible)).toBe(false);
  });

  it("duplicates an ad right after it with a new id", () => {
    const next = withAdDuplicated(formWith(2), 0, "(cópia)");
    expect(next.ads.map((ad) => ad.name)).toEqual(["Anúncio 1", "Anúncio 1 (cópia)", "Anúncio 2"]);
    expect(next.ads[1].id).not.toBe(next.ads[0].id);
  });

  it("removes an ad but never the last one", () => {
    expect(withAdRemoved(formWith(3), 1).ads.map((ad) => ad.name)).toEqual(["Anúncio 1", "Anúncio 3"]);
    const single = formWith(1);
    expect(withAdRemoved(single, 0)).toBe(single);
  });

  it("selects a neighbour after a removal", () => {
    expect(nodeAfterRemoval(adNode(2), 2)).toEqual(adNode(1));
    expect(nodeAfterRemoval(adNode(0), 0)).toEqual(adNode(0));
    expect(nodeAfterRemoval(adNode(3), 1)).toEqual(adNode(2));
    expect(nodeAfterRemoval(adNode(0), 1)).toEqual(adNode(0));
    expect(nodeAfterRemoval(AD_SET_NODE, 1)).toEqual(AD_SET_NODE);
  });
});

describe("object tree", () => {
  const rows = [
    row("c1", "campaign"),
    row("c2", "campaign"),
    row("s1", "adset", { campaignId: "c1" }),
    row("s2", "adset", { campaignId: "c1" }),
    row("s3", "adset", { campaignId: "c2" }),
    row("a1", "ad", { campaignId: "c1", adSetId: "s1" }),
    row("a2", "ad", { campaignId: "c1", adSetId: "s2" }),
    row("a3", "ad", { campaignId: "c1", adSetId: "s2" }),
    row("a4", "ad", { campaignId: "c2", adSetId: "s3" }),
  ];

  it("groups one campaign with its ad sets and ads", () => {
    const tree = objectTree(rows, "c1");
    expect(tree.campaign?.metaId).toBe("c1");
    expect(tree.adSets.map((branch) => [branch.row.metaId, branch.ads.map((ad) => ad.metaId)])).toEqual([
      ["s1", ["a1"]],
      ["s2", ["a2", "a3"]],
    ]);
  });

  it("orders the objects for back and forward", () => {
    expect(objectOrder(objectTree(rows, "c1")).map((item) => item.metaId)).toEqual(["c1", "s1", "a1", "s2", "a2", "a3"]);
  });

  it("builds the breadcrumb chain of an object", () => {
    const tree = objectTree(rows, "c1");
    expect(objectChain(tree, "a3").map((item) => item.metaId)).toEqual(["c1", "s2", "a3"]);
    expect(objectChain(tree, "s1").map((item) => item.metaId)).toEqual(["c1", "s1"]);
    expect(objectChain(tree, "c1").map((item) => item.metaId)).toEqual(["c1"]);
    expect(objectChain(tree, "nope")).toEqual([]);
  });

  it("returns an empty tree when the campaign is unknown", () => {
    expect(objectTree(rows, "zz")).toEqual({ campaign: null, adSets: [] });
  });
});
