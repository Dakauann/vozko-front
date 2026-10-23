import { describe, expect, it } from "vitest";

import {
  adminNavItems,
  affiliateNavItems,
  campanhasNavItems,
  navItemOpen,
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

const nothingLaunched = () => false;
const rcsOnly = (channel: string) => channel === "rcs";
const smsOnly = (channel: string) => channel === "sms";

describe("carrier items in the sidebar", () => {
  const family = campanhasNavItems.filter((item) => item.family === "rcs_sms");

  it("locks every RCS e SMS item while no carrier channel is launched", () => {
    expect(family.length).toBe(5);
    expect(family.filter((item) => navItemOpen(item, nothingLaunched))).toEqual([]);
    expect(navItemOpen(find(adminNavItems, "nav.adminCarrier"), nothingLaunched)).toBe(false);
  });

  it("opens shared items and the launched channel once one channel is launched", () => {
    const open = (launched: (channel: string) => boolean) => family.filter((item) => navItemOpen(item, launched)).map((item) => item.labelKey);
    expect(open(smsOnly)).toEqual(["nav.carrierOverview", "nav.carrierCampaigns", "nav.carrierSmsSenders", "nav.carrierSettings"]);
    expect(open(rcsOnly)).toEqual(["nav.carrierOverview", "nav.carrierCampaigns", "nav.carrierRcsSenders", "nav.carrierSettings"]);
    expect(navItemOpen(find(adminNavItems, "nav.adminCarrier"), rcsOnly)).toBe(true);
  });

  it("leaves every other family unaffected", () => {
    const others = [...campanhasNavItems, ...adminNavItems, ...affiliateNavItems].filter((item) => item.family !== "rcs_sms" && item.labelKey !== "nav.adminCarrier");
    expect(others.filter((item) => !navItemOpen(item, nothingLaunched))).toEqual([]);
  });
});

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
    for (const channel of ["whatsapp", "instagram", "facebook", "telegram", "mercadolivre", "tiktok", "webchat", "telephony", "unofficial-whatsapp"]) {
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

  it("groups Mercado Livre under its own family, each page gated by its own screen", () => {
    const mercadolivre = campanhasNavItems.filter((item) => item.family === "mercadolivre");
    expect(mercadolivre.map((item) => [item.labelKey, item.href])).toEqual([["nav.mercadolivre", "/dashboard/mercadolivre-accounts"]]);
    expect(hrefs(mercadolivre)).toEqual(["/dashboard/mercadolivre-accounts", "/dashboard/mercadolivre-accounts", "/dashboard/mercadolivre-accounts/connect"]);
    expect(navItemVisible(mercadolivre[0], () => false)).toBe(false);
    expect(navItemVisible(mercadolivre[0], (href) => href === "/dashboard/mercadolivre-accounts")).toBe(true);
    expect(ruleForPath("/dashboard/mercadolivre-accounts")).toEqual({ kind: "screen", screen: "mercadolivre_accounts" });
    expect(ruleForPath("/dashboard/mercadolivre-accounts/connect")).toEqual({ kind: "screen", screen: "mercadolivre_connect" });
    expect(ruleForPath("/dashboard/mercadolivre-accounts/123456")).toEqual({ kind: "screen", screen: "mercadolivre_account" });
  });

  it("groups TikTok under its own family, each page gated by its own screen", () => {
    const tiktok = campanhasNavItems.filter((item) => item.family === "tiktok");
    expect(tiktok.map((item) => [item.labelKey, item.href])).toEqual([["nav.tiktok", "/dashboard/tiktok-accounts"]]);
    expect(hrefs(tiktok)).toEqual(["/dashboard/tiktok-accounts", "/dashboard/tiktok-accounts", "/dashboard/tiktok-accounts/connect"]);
    expect(navItemVisible(tiktok[0], () => false)).toBe(false);
    expect(navItemVisible(tiktok[0], (href) => href === "/dashboard/tiktok-accounts")).toBe(true);
    expect(ruleForPath("/dashboard/tiktok-accounts")).toEqual({ kind: "screen", screen: "tiktok_accounts" });
    expect(ruleForPath("/dashboard/tiktok-accounts/connect")).toEqual({ kind: "screen", screen: "tiktok_connect" });
    expect(ruleForPath("/dashboard/tiktok-accounts/123456")).toEqual({ kind: "screen", screen: "tiktok_account" });
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

  it("groups the email area under its own family, each page gated by its own screen", () => {
    const email = campanhasNavItems.filter((item) => item.family === "email");
    expect(email.map((item) => [item.labelKey, item.href])).toEqual([
      ["nav.emailOverview", "/dashboard/email"],
      ["nav.emailCampaigns", "/dashboard/email/campaigns"],
      ["nav.emailDesigns", "/dashboard/email/designs"],
      ["nav.emailSenders", "/dashboard/email/senders"],
      ["nav.emailApi", "/dashboard/email/api"],
    ]);
    expect(hrefs(email.filter((item) => item.labelKey === "nav.emailCampaigns"))).toEqual([
      "/dashboard/email/campaigns",
      "/dashboard/email/campaigns",
      "/dashboard/email/campaigns/new",
    ]);
    expect(ruleForPath("/dashboard/email")).toEqual({ kind: "screen", screen: "email_overview" });
    expect(ruleForPath("/dashboard/email/campaigns/new")).toEqual({ kind: "screen", screen: "email_campaign_new" });
    expect(ruleForPath("/dashboard/email/senders")).toEqual({ kind: "screen", screen: "email_senders" });
    const campaigns = find(campanhasNavItems, "nav.emailCampaigns");
    expect(navItemVisible(campaigns, () => false)).toBe(false);
    expect(navItemVisible(campaigns, (href) => href === "/dashboard/email/campaigns/new")).toBe(true);
  });

  it("lists the email family before the Studio and Meta, which are not channels", () => {
    const order = [...new Set(campanhasNavItems.map((item) => item.family))];
    expect(order.indexOf("email")).toBeGreaterThan(order.indexOf("unofficial-whatsapp"));
    expect(order.indexOf("email")).toBeLessThan(order.indexOf("studio"));
  });

  it("keeps the email sender accounts admin page in the platform family, behind the platform admin rule", () => {
    const adminEmail = find(adminNavItems, "nav.adminEmail");
    expect(adminEmail.href).toBe("/dashboard/admin/email");
    expect(adminEmail.family).toBe("platform");
    expect(ruleForPath("/dashboard/admin/email")).toEqual({ kind: "platform_admin" });
  });

  it("groups RCS and SMS under their own family, each page gated by its own screen", () => {
    const carrier = campanhasNavItems.filter((item) => item.family === "rcs_sms");
    expect(carrier.map((item) => [item.labelKey, item.href])).toEqual([
      ["nav.carrierOverview", "/dashboard/rcs-sms"],
      ["nav.carrierCampaigns", "/dashboard/rcs-sms/campaigns"],
      ["nav.carrierRcsSenders", "/dashboard/rcs-sms/rcs-senders"],
      ["nav.carrierSmsSenders", "/dashboard/rcs-sms/sms-senders"],
      ["nav.carrierSettings", "/dashboard/rcs-sms/settings"],
    ]);
    expect(hrefs(carrier.filter((item) => item.labelKey === "nav.carrierCampaigns"))).toEqual([
      "/dashboard/rcs-sms/campaigns",
      "/dashboard/rcs-sms/campaigns",
      "/dashboard/rcs-sms/campaigns/new",
    ]);
    expect(ruleForPath("/dashboard/rcs-sms/campaigns/new")).toEqual({ kind: "screen", screen: "carrier_campaign_new" });
    const campaigns = find(campanhasNavItems, "nav.carrierCampaigns");
    expect(navItemVisible(campaigns, () => false)).toBe(false);
    expect(navItemVisible(campaigns, (href) => href === "/dashboard/rcs-sms/campaigns")).toBe(true);
  });

  it("lists RCS and SMS right after email, before the Studio", () => {
    const order = [...new Set(campanhasNavItems.map((item) => item.family))];
    expect(order.indexOf("rcs_sms")).toBe(order.indexOf("email") + 1);
    expect(order.indexOf("rcs_sms")).toBeLessThan(order.indexOf("studio"));
  });

  it("keeps the RCS and SMS admin page in the platform family, behind the platform admin rule", () => {
    const adminCarrier = find(adminNavItems, "nav.adminCarrier");
    expect(adminCarrier.href).toBe("/dashboard/admin/rcs-sms");
    expect(adminCarrier.family).toBe("platform");
    expect(ruleForPath("/dashboard/admin/rcs-sms")).toEqual({ kind: "platform_admin" });
  });

  it("shows a Meta page exactly when its own page would open", () => {
    const rules = find(campanhasNavItems, "nav.adsRules");
    expect(navItemVisible(rules, () => false)).toBe(false);
    expect(navItemVisible(rules, (href) => href === "/dashboard/advertising/rules")).toBe(true);
    expect(navItemVisible(rules, (href) => href === "/dashboard/advertising")).toBe(false);
  });
});
