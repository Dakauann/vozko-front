import { describe, expect, it } from "vitest";

import { managerHref, metaAdsResultFromMessage, newAdHref, overviewHref, pickAccountId, wizardHref } from "./connect";

describe("metaAdsResultFromMessage", () => {
  it("reads the popup message", () => {
    expect(metaAdsResultFromMessage({ source: "meta-ads-login", status: "connected", count: 2 })).toEqual({
      status: "connected",
      reason: undefined,
      count: 2,
    });
    expect(metaAdsResultFromMessage({ status: "error", reason: "missing_permissions" })).toEqual({
      status: "error",
      reason: "missing_permissions",
      count: undefined,
    });
  });

  it("ignores messages with an unknown status", () => {
    expect(metaAdsResultFromMessage({ status: "done" })).toBeNull();
  });
});

describe("pickAccountId", () => {
  it("prefers the first known candidate, then the first account", () => {
    expect(pickAccountId(["a", "b"], "x", "b")).toBe("b");
    expect(pickAccountId(["a", "b"], null)).toBe("a");
    expect(pickAccountId([], "a")).toBeNull();
  });
});

describe("wizardHref", () => {
  it("opens the wizard on the chosen parent or ad", () => {
    expect(wizardHref({ accountId: "a1", adSetId: "9" })).toBe("/dashboard/advertising/new?accountId=a1&adSetId=9");
    expect(wizardHref({ accountId: "a1", campaignId: "5" })).toBe("/dashboard/advertising/new?accountId=a1&campaignId=5");
    expect(wizardHref({ accountId: "a 1", adId: "7" })).toBe("/dashboard/advertising/new?accountId=a+1&adId=7");
  });
});

describe("managerHref", () => {
  it("points the manager at the account and the published campaign", () => {
    expect(managerHref({ accountId: "a 1", campaignId: "c1", published: true })).toBe(
      "/dashboard/advertising?account=a+1&campaign=c1&published=1",
    );
    expect(managerHref({ accountId: "a1", jobs: true })).toBe("/dashboard/advertising?account=a1&jobs=1");
  });
});

describe("newAdHref", () => {
  it("opens the wizard on the chosen account", () => {
    expect(newAdHref("a1")).toBe("/dashboard/advertising/new?accountId=a1");
    expect(newAdHref(null)).toBe("/dashboard/advertising/new");
  });
});

describe("overviewHref", () => {
  it("opens the account overview on the chosen account", () => {
    expect(overviewHref("a 1")).toBe("/dashboard/advertising/overview?account=a+1");
  });
});
