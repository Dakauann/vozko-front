import { describe, expect, it } from "vitest";

import { readGroupPrefill } from "@/lib/unofficial-whatsapp-campaigns/group-audience";

import {
  GROUPS_BASE,
  groupsRoutes,
  parseAllGroupsQuery,
  parseAnalysisWindow,
  parseDetailTab,
  parseGroupLinkMembers,
  parseSetupSteps,
} from "./routes";

function paramsOf(href: string): URLSearchParams {
  return new URLSearchParams(href.split("?")[1] ?? "");
}

describe("groupsRoutes", () => {
  it("builds the fixed paths", () => {
    expect(groupsRoutes.root).toBe(GROUPS_BASE);
    expect(groupsRoutes.numbers).toBe("/dashboard/unofficial-whatsapp");
    expect(groupsRoutes.lead("lead 1")).toBe("/dashboard/leads/lead%201");
    expect(groupsRoutes.campaign("c1")).toBe("/dashboard/unofficial-whatsapp-campaigns/c1");
  });

  it("builds the all groups link with only the filters given", () => {
    expect(groupsRoutes.all()).toBe(`${GROUPS_BASE}/all`);
    expect(groupsRoutes.all({ search: "  ", followed: true, origin: "external", sort: "members" })).toBe(
      `${GROUPS_BASE}/all?followed=1&origin=external&sort=members`,
    );
  });

  it("keeps an empty category so no category reaches the page", () => {
    const href = groupsRoutes.all({ category: "" });
    expect(href).toBe(`${GROUPS_BASE}/all?category=`);
    expect(parseAllGroupsQuery(paramsOf(href))).toEqual({ category: "" });
  });

  it("round trips the all groups query", () => {
    const query = {
      action: "join" as const,
      search: "vendas",
      followed: false,
      origin: "managed" as const,
      category: "Clientes",
      instanceId: "i1",
      hasAnalysis: true,
      adminsOnly: true,
      sort: "name_desc" as const,
    };
    expect(parseAllGroupsQuery(paramsOf(groupsRoutes.all(query)))).toEqual(query);
  });

  it("drops unknown values when parsing the all groups query", () => {
    expect(parseAllGroupsQuery(new URLSearchParams("origin=mine&sort=best&action=nuke&adminsOnly=maybe"))).toEqual({});
  });

  it("keeps the open groups choice of the send permission filter", () => {
    const href = groupsRoutes.all({ adminsOnly: false });
    expect(href).toBe(`${GROUPS_BASE}/all?adminsOnly=0`);
    expect(parseAllGroupsQuery(paramsOf(href))).toEqual({ adminsOnly: false });
  });

  it("builds group links with tab and member options", () => {
    expect(groupsRoutes.group("g/1")).toBe(`${GROUPS_BASE}/g%2F1`);
    expect(groupsRoutes.group("g1", { tab: "overview" })).toBe(`${GROUPS_BASE}/g1`);
    expect(groupsRoutes.group("g1", { tab: "settings" })).toBe(`${GROUPS_BASE}/g1?tab=settings`);
    expect(groupsRoutes.group("g1", { members: { status: "left" } })).toBe(`${GROUPS_BASE}/g1?tab=members&members=left`);
    expect(groupsRoutes.group("g1", { members: { search: "ana", lead: true } })).toBe(`${GROUPS_BASE}/g1?tab=members&msearch=ana&lead=1`);
    expect(paramsOf(groupsRoutes.group("g1", { tab: "settings", setup: ["description", "admins_only"] })).get("setup")).toBe(
      "description,admins_only",
    );
  });

  it("builds analyses links", () => {
    expect(groupsRoutes.analyses()).toBe(`${GROUPS_BASE}/analyses`);
    expect(groupsRoutes.analyses({ groupId: "g1", status: "paused", action: "create" })).toBe(
      `${GROUPS_BASE}/analyses?groupId=g1&status=paused&action=create`,
    );
    expect(groupsRoutes.analysis("a1")).toBe(`${GROUPS_BASE}/analyses/a1`);
    expect(groupsRoutes.analysis("a1", { days: 30 })).toBe(`${GROUPS_BASE}/analyses/a1`);
    expect(groupsRoutes.analysis("a1", { days: -1, run: "r9" })).toBe(`${GROUPS_BASE}/analyses/a1?days=-1&run=r9`);
  });

  it("builds people links", () => {
    expect(groupsRoutes.people()).toBe(`${GROUPS_BASE}/people`);
    expect(groupsRoutes.people({ search: "ana", minGroups: 3 })).toBe(`${GROUPS_BASE}/people?search=ana&minGroups=3`);
  });

  it("builds a campaign link the composer prefill reads", () => {
    const href = groupsRoutes.newCampaign("", ["g1", "g2", "g1", " "]);
    expect(href.startsWith("/dashboard/unofficial-whatsapp-campaigns/new?")).toBe(true);
    const params = paramsOf(href);
    expect(params.has("instanceId")).toBe(false);
    expect(readGroupPrefill(Object.fromEntries(params.entries()))).toEqual({ groupIds: ["g1", "g2"] });
  });
});

describe("parseDetailTab", () => {
  it("accepts known tabs and falls back to overview", () => {
    expect(parseDetailTab("members")).toBe("members");
    expect(parseDetailTab("nope")).toBe("overview");
    expect(parseDetailTab(null)).toBe("overview");
  });
});

describe("parseGroupLinkMembers", () => {
  it("reads the member options", () => {
    expect(parseGroupLinkMembers(new URLSearchParams("members=left&msearch=%20ana%20&lead=1"))).toEqual({ status: "left", search: "ana", lead: true });
    expect(parseGroupLinkMembers(new URLSearchParams("members=all"))).toEqual({ status: "all" });
  });

  it("returns undefined when no member option is present", () => {
    expect(parseGroupLinkMembers(new URLSearchParams("tab=members&members=gone"))).toBeUndefined();
  });
});

describe("parseSetupSteps", () => {
  it("keeps known steps once", () => {
    expect(parseSetupSteps("description,admins_only,description,bogus")).toEqual(["description", "admins_only"]);
    expect(parseSetupSteps(null)).toEqual([]);
    expect(parseSetupSteps("")).toEqual([]);
  });
});

describe("parseAnalysisWindow", () => {
  it("accepts the windows and defaults to 30", () => {
    expect(parseAnalysisWindow("7")).toBe(7);
    expect(parseAnalysisWindow("90")).toBe(90);
    expect(parseAnalysisWindow("-1")).toBe(-1);
    expect(parseAnalysisWindow("all")).toBe(-1);
    expect(parseAnalysisWindow("14")).toBe(30);
    expect(parseAnalysisWindow("")).toBe(30);
    expect(parseAnalysisWindow(null)).toBe(30);
  });
});
