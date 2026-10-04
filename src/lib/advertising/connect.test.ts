import { describe, expect, it } from "vitest";

import {
  draftEditorHref,
  managerHref,
  metaAdsResultFromMessage,
  newAdHref,
  objectEditorHref,
  objectsEditorHref,
  overviewHref,
  pickAccountId,
  reportHref,
  reportTemplateHref,
} from "./connect";

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

describe("managerHref", () => {
  it("points the manager at the account and the published campaign", () => {
    expect(managerHref({ accountId: "a 1", campaignId: "c1", published: true })).toBe(
      "/dashboard/advertising?account=a+1&selected_campaign_ids=c1&published=1",
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

describe("editor and report links", () => {
  it("opens a draft or a published object in the editor", () => {
    expect(draftEditorHref("d-1")).toBe("/dashboard/advertising/editor?draft=d-1");
    expect(objectEditorHref("a-1", "120")).toBe("/dashboard/advertising/editor?object=120&account=a-1");
    expect(objectsEditorHref("a-1", ["120", "121"])).toBe("/dashboard/advertising/editor?objects=120%2C121&account=a-1");
  });

  it("opens a saved report or a template", () => {
    expect(reportHref("r/1")).toBe("/dashboard/advertising/reports/r%2F1");
    expect(reportTemplateHref("age_gender", "a-1")).toBe("/dashboard/advertising/reports/new?template=age_gender&account=a-1");
  });
});
