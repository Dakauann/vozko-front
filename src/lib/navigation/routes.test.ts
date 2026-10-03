import { readdirSync } from "fs";
import { join, sep } from "path";
import { describe, expect, it } from "vitest";

import { isScreenKey, isUpcomingPath, isUpcomingScreen, pathForScreen, ruleForPath, screenPaths } from "./routes";

const dashboardDir = join(__dirname, "..", "..", "app", "[locale]", "dashboard");

function dashboardRoutes(): string[] {
  return readdirSync(dashboardDir, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith(`${sep}page.tsx`) || file === "page.tsx")
    .map((file) => file.replace(/page\.tsx$/, "").split(sep).filter(Boolean).filter((part) => !part.startsWith("(")))
    .map((parts) => ["/dashboard", ...parts].join("/"));
}

describe("route rules", () => {
  it("covers every dashboard page, so no page ships ungated", () => {
    const routes = dashboardRoutes();
    expect(routes.length).toBeGreaterThan(50);
    const uncovered = routes.filter((route) => ruleForPath(route) === null);
    expect(uncovered).toEqual([]);
  });

  it("gives every registered screen a real page", () => {
    const routes = new Set(dashboardRoutes());
    const orphans = Object.values(screenPaths).filter((path) => !routes.has(path));
    expect(orphans).toEqual([]);
  });

  it("prefers static segments over params", () => {
    expect(ruleForPath("/dashboard/agents/new")).toEqual({ kind: "screen", screen: "agent_new" });
    expect(ruleForPath("/dashboard/agents/archived")).toEqual({ kind: "screen", screen: "agents_archived" });
    expect(ruleForPath("/dashboard/agents/mcp")).toEqual({ kind: "screen", screen: "mcp_servers" });
    expect(ruleForPath("/dashboard/agents/7b1c2f9e")).toEqual({ kind: "screen", screen: "agent_detail" });
    expect(ruleForPath("/dashboard/whatsapp-templates/manage")).toEqual({ kind: "platform_admin" });
  });

  it("covers subpages through their closest screen", () => {
    expect(ruleForPath("/dashboard/agents/abc/edit/beginner")).toEqual({ kind: "screen", screen: "agent_edit" });
    expect(ruleForPath("/dashboard/agents/new/professional")).toEqual({ kind: "screen", screen: "agent_new" });
    expect(ruleForPath("/dashboard/funnels?tab=x")).toEqual({ kind: "screen", screen: "funnels" });
  });

  it("gates the ad editor like creating an ad, not like reading the manager", () => {
    expect(ruleForPath("/dashboard/advertising/editor?draft=d1")).toEqual({ kind: "screen", screen: "ads_editor" });
    expect(ruleForPath("/dashboard/advertising/new")).toEqual({ kind: "screen", screen: "ads_create" });
  });

  it("keeps personal routes exact so they never open other pages", () => {
    expect(ruleForPath("/dashboard")).toEqual({ kind: "personal" });
    expect(ruleForPath("/dashboard/unknown-page")).toBeNull();
    expect(ruleForPath("/dashboard/profile/other")).toBeNull();
  });

  it("classifies platform and manager areas", () => {
    expect(ruleForPath("/dashboard/users/abc/balance")).toEqual({ kind: "platform_admin" });
    expect(ruleForPath("/dashboard/plans/manage")).toEqual({ kind: "platform_admin" });
    expect(ruleForPath("/dashboard/plans")).toEqual({ kind: "screen", screen: "plans" });
    expect(ruleForPath("/dashboard/affiliate/earnings")).toEqual({ kind: "workspace_manager" });
  });
});

describe("pathForScreen", () => {
  it("builds static and parameterised paths", () => {
    expect(pathForScreen("funnels")).toBe("/dashboard/funnels");
    expect(pathForScreen("agent_detail", { agentId: "7b1c2f9e-0a51" })).toBe("/dashboard/agents/7b1c2f9e-0a51");
  });

  it("refuses missing, extra or unsafe params", () => {
    expect(pathForScreen("agent_detail")).toBeNull();
    expect(pathForScreen("agent_detail", { agentId: "../admin" })).toBeNull();
    expect(pathForScreen("funnels", { agentId: "x" })).toBeNull();
    expect(pathForScreen("agent_detail", { agentId: "a", other: "b" })).toBeNull();
  });

  it("recognises screen keys", () => {
    expect(isScreenKey("funnels")).toBe(true);
    expect(isScreenKey("toString")).toBe(false);
    expect(isScreenKey("nowhere")).toBe(false);
  });
});

describe("upcoming screens", () => {
  it("leaves released channels alone", () => {
    expect(isUpcomingScreen("facebook_pages")).toBe(false);
    expect(isUpcomingScreen("facebook_connect")).toBe(false);
    expect(isUpcomingPath("/dashboard/facebook-pages/123456")).toBe(false);
    expect(isUpcomingScreen("instagram_accounts")).toBe(false);
    expect(isUpcomingPath("/dashboard/instagram-accounts")).toBe(false);
    expect(isUpcomingPath("/dashboard/not-registered")).toBe(false);
  });
});
