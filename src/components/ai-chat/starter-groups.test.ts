import { describe, expect, it } from "vitest";

import type { ResourceAction, ResourceType } from "@/lib/workspace/types";

import { starterGroupsFor } from "./starter-groups";

const grant =
  (...allowed: string[]) =>
  (resource: ResourceType, action: ResourceAction) =>
    allowed.includes(`${resource}:${action}`);

const everything = grant(
  "attendance:read",
  "whatsapp_campaigns:read",
  "audience:read",
  "agents:read",
  "agents:create",
);

describe("starterGroupsFor", () => {
  it("offers only the categories the user can read", () => {
    const groups = starterGroupsFor(grant("agents:read"), "/dashboard");
    expect(groups.groups.map((g) => g.key)).toEqual(["agents"]);
  });

  it("drops a shortcut that changes something the user cannot change", () => {
    const readOnly = starterGroupsFor(grant("agents:read"), "/dashboard").groups[0];
    expect(readOnly.items).not.toContain("create");
    const editor = starterGroupsFor(everything, "/dashboard").groups.find((g) => g.key === "agents");
    expect(editor?.items).toContain("create");
  });

  it("opens the category of the page the user is on", () => {
    expect(starterGroupsFor(everything, "/dashboard/attendance").open).toBe("attendance");
    expect(starterGroupsFor(everything, "/dashboard/agents/123/edit").open).toBe("agents");
    expect(starterGroupsFor(everything, "/dashboard/whatsapp-campaigns/abc").open).toBe("campaigns");
    expect(starterGroupsFor(everything, "/dashboard/unofficial-whatsapp-campaigns").open).toBe("campaigns");
    expect(starterGroupsFor(everything, "/dashboard/audience").open).toBe("customers");
  });

  it("opens the first category it can offer when the page has none, and nothing when it offers none", () => {
    expect(starterGroupsFor(grant("audience:read", "agents:read"), "/dashboard/settings").open).toBe("customers");
    expect(starterGroupsFor(grant("agents:read"), "/dashboard/attendance").open).toBe("agents");
    expect(starterGroupsFor(grant(), "/dashboard")).toEqual({ groups: [], open: null });
  });
});
