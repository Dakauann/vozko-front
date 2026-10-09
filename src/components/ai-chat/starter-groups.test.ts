import { describe, expect, it } from "vitest";

import type { ResourceAction, ResourceType } from "@/lib/workspace/types";

import { starterGroupsFor } from "./starter-groups";

const grant =
  (...allowed: string[]) =>
  (resource: ResourceType, action: ResourceAction) =>
    allowed.includes(`${resource}:${action}`);

const everything = grant(
  "ai_chat:read",
  "business_phones:create",
  "balance:read",
  "attendance:read",
  "conversations:read",
  "conversations:send",
  "conversations:create",
  "leads:read",
  "labels:assign",
  "stages:read",
  "stages:create",
  "whatsapp_campaigns:read",
  "whatsapp_campaigns:create",
  "unofficial_whatsapp_campaigns:read",
  "unofficial_whatsapp_campaigns:create",
  "whatsapp_templates:read",
  "whatsapp_templates:create",
  "audience:read",
  "knowledge_bases:read",
  "knowledge_bases:create",
  "calendar:read",
  "calendar:create",
  "workflows:read",
  "agents:read",
  "agents:create",
  "members:read",
  "members:create",
  "members:update",
  "departments:update",
  "roles:read",
);

describe("starterGroupsFor", () => {
  it("covers every area the assistant can work on", () => {
    expect(starterGroupsFor(everything, "/dashboard").groups.map((g) => g.key)).toEqual([
      "start",
      "attendance",
      "conversations",
      "funnels",
      "campaigns",
      "customers",
      "knowledge",
      "schedule",
      "team",
      "agents",
    ]);
  });

  it("always offers the questions about what the assistant can do and about access", () => {
    const start = starterGroupsFor(grant("ai_chat:read"), "/dashboard").groups;
    expect(start).toEqual([
      { key: "start", items: ["capabilities", "setup"], live: false },
      { key: "team", items: ["access", "explain"], live: false },
    ]);
  });

  it("offers only the starters the user is allowed to act on", () => {
    const reader = starterGroupsFor(grant("whatsapp_templates:read", "agents:read"), "/dashboard").groups;
    expect(reader.find((g) => g.key === "campaigns")?.items).toEqual(["templates"]);
    expect(reader.find((g) => g.key === "agents")?.items).not.toContain("create");
    const editor = starterGroupsFor(everything, "/dashboard").groups.find((g) => g.key === "campaigns");
    expect(editor?.items).toEqual(["results", "failures", "best", "templates", "createTemplate", "createCampaign", "createQrCampaign"]);
  });

  it("shows campaigns to a team that only uses QR code numbers", () => {
    const qrOnly = starterGroupsFor(grant("unofficial_whatsapp_campaigns:create"), "/dashboard").groups;
    expect(qrOnly).toEqual([{ key: "campaigns", items: ["createQrCampaign"], live: false }]);
  });

  it("opens the category of the page the user is on", () => {
    const openOn = (path: string) => starterGroupsFor(everything, path).open;
    expect(openOn("/dashboard/attendance")).toBe("attendance");
    expect(openOn("/dashboard/agents/123/edit")).toBe("agents");
    expect(openOn("/dashboard/unofficial-whatsapp-campaigns")).toBe("campaigns");
    expect(openOn("/dashboard/whatsapp-templates/new")).toBe("campaigns");
    expect(openOn("/dashboard/live-chat")).toBe("conversations");
    expect(openOn("/dashboard/funnels")).toBe("funnels");
    expect(openOn("/dashboard/knowledge-bases/kb-1")).toBe("knowledge");
    expect(openOn("/dashboard/calendar")).toBe("schedule");
    expect(openOn("/dashboard/audience")).toBe("customers");
    expect(openOn("/dashboard/workspace")).toBe("team");
  });

  it("opens where to start when the page has no category, and nothing when it offers none", () => {
    expect(starterGroupsFor(everything, "/dashboard/settings").open).toBe("start");
    expect(starterGroupsFor(grant("audience:read", "agents:read"), "/dashboard/settings").open).toBe("customers");
    expect(starterGroupsFor(grant(), "/dashboard")).toEqual({ groups: [], open: null });
  });

  it("offers team management only to people who may manage the team", () => {
    const reader = starterGroupsFor(grant("members:read"), "/dashboard").groups;
    expect(reader).toEqual([{ key: "team", items: ["members", "permissions"], live: false }]);
    const manager = starterGroupsFor(everything, "/dashboard").groups.find((g) => g.key === "team");
    expect(manager?.items).toEqual(["access", "explain", "members", "invite", "permissions", "grant", "department", "roles"]);
  });

  it("lets any member ask why they cannot see or do something", () => {
    const member = starterGroupsFor(grant("ai_chat:read"), "/dashboard/workspace").groups.find((g) => g.key === "team");
    expect(member?.items).toEqual(["access", "explain"]);
  });

  it("offers the ads group only with ads:read, and creation only with ads:create", () => {
    expect(starterGroupsFor(grant("ads:read"), "/dashboard/advertising")).toEqual({
      groups: [{ key: "ads", items: ["results", "best"], live: false }],
      open: "ads",
    });
    const creator = starterGroupsFor(grant("ads:read", "ads:create"), "/dashboard").groups;
    expect(creator).toEqual([{ key: "ads", items: ["results", "best", "create"], live: false }]);
    expect(starterGroupsFor(everything, "/dashboard").groups.some((g) => g.key === "ads")).toBe(false);
  });
});

describe("studio starters", () => {
  const editor = grant("ai_chat:read", "media:read", "media:create");

  it("opens the video editing starters inside a video project", () => {
    const { groups, open } = starterGroupsFor(editor, "/dashboard/studio/video/p-1");
    expect(open).toBe("studioVideo");
    expect(groups.find((g) => g.key === "studioVideo")?.items).toContain("captions");
    expect(groups.some((g) => g.key === "studioImage")).toBe(false);
  });

  it("opens the image starters inside an image project", () => {
    expect(starterGroupsFor(editor, "/dashboard/studio/image/p-1").open).toBe("studioImage");
  });

  it("never offers editing starters outside a project, where Elo cannot edit", () => {
    const { groups } = starterGroupsFor(editor, "/dashboard/studio");
    expect(groups.some((g) => g.key === "studioVideo" || g.key === "studioImage")).toBe(false);
  });

  it("needs media creation to edit", () => {
    const { groups } = starterGroupsFor(grant("ai_chat:read", "media:read"), "/dashboard/studio/video/p-1");
    expect(groups.find((g) => g.key === "studioVideo")?.items).toEqual(["review"]);
  });
});

describe("studio starters come first inside a project", () => {
  it("puts the editing group above the general ones", () => {
    const { groups } = starterGroupsFor(grant("ai_chat:read", "media:read", "media:create", "attendance:read"), "/dashboard/studio/image/p-1");
    expect(groups[0].key).toBe("studioImage");
  });

  it("keeps the order elsewhere", () => {
    const { groups } = starterGroupsFor(grant("ai_chat:read", "attendance:read"), "/dashboard/attendance");
    expect(groups[0].key).toBe("start");
  });
});
