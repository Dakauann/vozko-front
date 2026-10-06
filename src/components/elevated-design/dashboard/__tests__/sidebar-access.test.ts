import { describe, expect, it } from "vitest";

import {
  adminNavItems,
  affiliateNavItems,
  campanhasNavItems,
  navItemVisible,
  type NavItem,
} from "@/components/elevated-design/dashboard/sidebar";
import { ruleForPath } from "@/lib/navigation/routes";

function hrefs(items: NavItem[]): string[] {
  return items.flatMap((item) => [item.href, ...hrefs(item.children ?? [])]);
}

function find(items: NavItem[], labelKey: string): NavItem {
  for (const item of items) {
    if (item.labelKey === labelKey) return item;
    const nested = item.children ? find(item.children, labelKey) : undefined;
    if (nested) return nested;
  }
  return undefined as unknown as NavItem;
}

describe("sidebar access", () => {
  it("links only to registered routes", () => {
    const all = hrefs([...campanhasNavItems, ...adminNavItems, ...affiliateNavItems]);
    expect(all.filter((href) => ruleForPath(href) === null)).toEqual([]);
  });

  it("shows a link exactly when its page would open", () => {
    const knowledge = find(campanhasNavItems, "nav.knowledgeBasesList");
    expect(navItemVisible(knowledge, (href) => href === "/dashboard/knowledge-bases")).toBe(true);
    expect(navItemVisible(knowledge, () => false)).toBe(false);
  });

  it("shows a parent while at least one child is visible", () => {
    const metrics = find(campanhasNavItems, "nav.metrics");
    expect(navItemVisible(metrics, (href) => href === "/dashboard/reports")).toBe(true);
    expect(navItemVisible(metrics, (href) => href === "/dashboard/metrics-home")).toBe(false);
  });

  it("shows Facebook exactly when its pages would open, like every released channel", () => {
    const facebook = find(campanhasNavItems, "nav.facebook");
    expect(navItemVisible(facebook, () => false)).toBe(false);
    expect(navItemVisible(facebook, (href) => href === "/dashboard/facebook-pages")).toBe(true);
  });

  it("groups every ads page under Meta, outside the Facebook family", () => {
    const meta = campanhasNavItems.filter((item) => item.family === "meta");
    expect(meta.map((item) => [item.labelKey, item.href])).toEqual([
      ["nav.adsOverview", "/dashboard/advertising/overview"],
      ["nav.adsManager", "/dashboard/advertising"],
      ["nav.adsReports", "/dashboard/advertising/reports"],
      ["nav.adsAudiences", "/dashboard/advertising/audiences"],
      ["nav.adsForms", "/dashboard/advertising/forms"],
      ["nav.adsRules", "/dashboard/advertising/rules"],
      ["nav.adsConversions", "/dashboard/advertising/conversions"],
      ["nav.adsPages", "/dashboard/advertising/pages"],
    ]);
    const facebook = hrefs(campanhasNavItems.filter((item) => item.family === "facebook"));
    expect(facebook.filter((href) => href.startsWith("/dashboard/advertising"))).toEqual([]);
  });

  it("lists Meta after every channel, since ads are not a channel", () => {
    const order = [...new Set(campanhasNavItems.map((item) => item.family))];
    const meta = order.indexOf("meta");
    for (const channel of ["whatsapp", "instagram", "facebook", "telegram", "webchat", "telephony", "unofficial-whatsapp"]) {
      expect(order.indexOf(channel), `${channel} should come before Meta`).toBeLessThan(meta);
    }
    expect(order[meta + 1]).toBe("management");
  });

  it("gates each Meta page by its own screen", () => {
    expect(ruleForPath("/dashboard/advertising/overview")).toEqual({ kind: "screen", screen: "ads_overview" });
    expect(ruleForPath("/dashboard/advertising")).toEqual({ kind: "screen", screen: "ads_manager" });
    expect(ruleForPath("/dashboard/advertising/new")).toEqual({ kind: "screen", screen: "ads_create" });
    expect(ruleForPath("/dashboard/advertising/audiences")).toEqual({ kind: "screen", screen: "ads_audiences" });
    expect(ruleForPath("/dashboard/advertising/forms")).toEqual({ kind: "screen", screen: "ads_forms" });
    expect(ruleForPath("/dashboard/advertising/rules")).toEqual({ kind: "screen", screen: "ads_rules" });
    expect(ruleForPath("/dashboard/advertising/conversions")).toEqual({ kind: "screen", screen: "ads_conversions" });
    expect(ruleForPath("/dashboard/advertising/pages")).toEqual({ kind: "screen", screen: "ads_pages" });
  });

  it("gates each website chat page by its own screen", () => {
    expect(ruleForPath("/dashboard/webchat")).toEqual({ kind: "screen", screen: "webchat_widgets" });
    expect(ruleForPath("/dashboard/webchat/new")).toEqual({ kind: "screen", screen: "webchat_new" });
    expect(ruleForPath("/dashboard/webchat/abc")).toEqual({ kind: "screen", screen: "webchat_widget" });
  });

  it("gates the ads reports pages behind their own screen", () => {
    for (const path of ["/dashboard/advertising/reports", "/dashboard/advertising/reports/new", "/dashboard/advertising/reports/abc"]) {
      expect(ruleForPath(path)).toEqual({ kind: "screen", screen: "ads_reports" });
    }
  });

  it("groups the Studio under its own family, gated by the project list screen", () => {
    const studio = campanhasNavItems.filter((item) => item.family === "studio");
    expect(studio.map((item) => [item.labelKey, item.href])).toEqual([
      ["nav.studioProjects", "/dashboard/studio"],
      ["nav.studioNewImage", "/dashboard/studio?new=image"],
      ["nav.studioNewVideo", "/dashboard/studio?new=video"],
    ]);
    for (const item of studio) expect(ruleForPath(item.href)).toEqual({ kind: "screen", screen: "studio" });
    expect(ruleForPath("/dashboard/studio/image/p-1")).toEqual({ kind: "screen", screen: "studio_image" });
    expect(ruleForPath("/dashboard/studio/video/p-1")).toEqual({ kind: "screen", screen: "studio_video" });
  });

  it("shows a Meta page exactly when its own page would open", () => {
    const rules = find(campanhasNavItems, "nav.adsRules");
    expect(navItemVisible(rules, () => false)).toBe(false);
    expect(navItemVisible(rules, (href) => href === "/dashboard/advertising/rules")).toBe(true);
    expect(navItemVisible(rules, (href) => href === "/dashboard/advertising")).toBe(false);
  });
});
