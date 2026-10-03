import { describe, expect, it } from "vitest";

import { createDialogHref, newRouteTarget } from "./editor-entry";

function paramsOf(href: string): URLSearchParams {
  return new URLSearchParams(href.split("?")[1] ?? "");
}

describe("newRouteTarget", () => {
  it("opens the create dialog over the manager for the account", () => {
    expect(newRouteTarget(new URLSearchParams({ accountId: "a1" }))).toBe("/dashboard/advertising?create=1&account=a1");
    expect(newRouteTarget(new URLSearchParams({ account: "a2" }))).toBe("/dashboard/advertising?create=1&account=a2");
    expect(newRouteTarget(new URLSearchParams())).toBe("/dashboard/advertising?create=1");
  });

  it("keeps the parent of a wizard link", () => {
    expect(newRouteTarget(paramsOf("/dashboard/advertising/new?accountId=a1&campaignId=5"))).toBe(
      "/dashboard/advertising?create=1&account=a1&campaignId=5",
    );
    expect(newRouteTarget(paramsOf("/dashboard/advertising/new?accountId=a1&adSetId=9"))).toBe(
      "/dashboard/advertising?create=1&account=a1&adSetId=9",
    );
  });

  it("sends a creative swap to the object editor", () => {
    expect(newRouteTarget(paramsOf("/dashboard/advertising/new?accountId=a1&adId=7"))).toBe("/dashboard/advertising/editor?object=7&account=a1");
  });

  it("does not open an object without its account", () => {
    expect(newRouteTarget(new URLSearchParams({ adId: "7" }))).toBe("/dashboard/advertising?create=1");
  });
});

describe("createDialogHref", () => {
  it("builds the manager link that opens the dialog", () => {
    expect(createDialogHref({ accountId: "a 1", campaignId: "5", adSetId: "" })).toBe("/dashboard/advertising?create=1&account=a+1&campaignId=5");
    expect(createDialogHref({})).toBe("/dashboard/advertising?create=1");
  });
});
