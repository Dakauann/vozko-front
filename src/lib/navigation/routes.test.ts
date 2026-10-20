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

  it("opens the lead companies through their own screen, never as a lead id", () => {
    expect(ruleForPath("/dashboard/leads/companies")).toEqual({ kind: "screen", screen: "lead_companies" });
    expect(ruleForPath("/dashboard/leads/7b1c2f9e-0a51")).toEqual({ kind: "screen", screen: "lead_detail" });
  });

  it("opens the call lists and their worker page through their own screens", () => {
    expect(ruleForPath("/dashboard/call-lists")).toEqual({ kind: "screen", screen: "call_lists" });
    expect(ruleForPath("/dashboard/call-lists/7b1c2f9e-0a51")).toEqual({ kind: "screen", screen: "call_list_detail" });
    expect(pathForScreen("call_list_detail", { listId: "7b1c2f9e-0a51" })).toBe("/dashboard/call-lists/7b1c2f9e-0a51");
  });

  it("opens the forms list, the gallery, a form and its builder through their own screens", () => {
    expect(ruleForPath("/dashboard/whatsapp-forms")).toEqual({ kind: "screen", screen: "whatsapp_forms" });
    expect(ruleForPath("/dashboard/whatsapp-forms/new")).toEqual({ kind: "screen", screen: "whatsapp_form_new" });
    expect(ruleForPath("/dashboard/whatsapp-forms/7b1c2f9e-0a51?view=sends")).toEqual({ kind: "screen", screen: "whatsapp_form_detail" });
    expect(ruleForPath("/dashboard/whatsapp-forms/7b1c2f9e-0a51/edit")).toEqual({ kind: "screen", screen: "whatsapp_form_builder" });
    expect(pathForScreen("whatsapp_form_builder", { formId: "7b1c2f9e-0a51" })).toBe("/dashboard/whatsapp-forms/7b1c2f9e-0a51/edit");
  });

  it("opens the workflow secrets through their own screen, never as a workflow id", () => {
    expect(ruleForPath("/dashboard/workflows/secrets")).toEqual({ kind: "screen", screen: "workflow_secrets" });
    expect(ruleForPath("/dashboard/workflows/7b1c2f9e-0a51")).toEqual({ kind: "screen", screen: "workflow_detail" });
    expect(pathForScreen("workflow_secrets")).toBe("/dashboard/workflows/secrets");
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
    expect(ruleForPath("/dashboard/admin/geocoding")).toEqual({ kind: "platform_admin" });
    expect(ruleForPath("/dashboard/plans")).toEqual({ kind: "screen", screen: "plans" });
    expect(ruleForPath("/dashboard/affiliate/earnings")).toEqual({ kind: "workspace_manager" });
  });
});

describe("Mercado Livre screens", () => {
  it("opens the account list, the connect flow and an account through their own screens", () => {
    expect(ruleForPath("/dashboard/mercadolivre-accounts")).toEqual({ kind: "screen", screen: "mercadolivre_accounts" });
    expect(ruleForPath("/dashboard/mercadolivre-accounts/connect")).toEqual({ kind: "screen", screen: "mercadolivre_connect" });
    expect(ruleForPath("/dashboard/mercadolivre-accounts/7b1c2f9e-0a51?tab=questions")).toEqual({ kind: "screen", screen: "mercadolivre_account" });
    expect(pathForScreen("mercadolivre_account", { accountId: "7b1c2f9e-0a51" })).toBe("/dashboard/mercadolivre-accounts/7b1c2f9e-0a51");
  });
});

describe("TikTok screens", () => {
  it("opens the account list, the connect flow and an account through their own screens", () => {
    expect(ruleForPath("/dashboard/tiktok-accounts")).toEqual({ kind: "screen", screen: "tiktok_accounts" });
    expect(ruleForPath("/dashboard/tiktok-accounts/connect")).toEqual({ kind: "screen", screen: "tiktok_connect" });
    expect(ruleForPath("/dashboard/tiktok-accounts/7b1c2f9e-0a51?tab=videos")).toEqual({ kind: "screen", screen: "tiktok_account" });
    expect(pathForScreen("tiktok_account", { accountId: "7b1c2f9e-0a51" })).toBe("/dashboard/tiktok-accounts/7b1c2f9e-0a51");
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
    expect(isUpcomingScreen("mercadolivre_accounts")).toBe(false);
    expect(isUpcomingPath("/dashboard/mercadolivre-accounts/123456")).toBe(false);
    expect(isUpcomingPath("/dashboard/not-registered")).toBe(false);
  });
});
