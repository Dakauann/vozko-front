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
});
