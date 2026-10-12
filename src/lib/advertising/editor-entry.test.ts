import { describe, expect, it } from "vitest";

import { CREATE_MEDIA_PARAMS, createDialogHref, newRouteTarget, requestedMedia } from "./editor-entry";

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

describe("a creative handed to the create dialog", () => {
  it("carries the media in the manager link", () => {
    expect(createDialogHref({ media: { kind: "video", mediaId: "6f1c2a3b-0000-4000-8000-000000000001" } })).toBe(
      "/dashboard/advertising?create=1&media=6f1c2a3b-0000-4000-8000-000000000001&mediaKind=video",
    );
  });

  it("reads back only a well formed media", () => {
    expect(requestedMedia(paramsOf("/x?media=abc-1&mediaKind=image"))).toEqual({ kind: "image", mediaId: "abc-1" });
    expect(requestedMedia(paramsOf("/x?media=abc-1&mediaKind=audio"))).toBeNull();
    expect(requestedMedia(paramsOf("/x?media=a%2Fb&mediaKind=image"))).toBeNull();
    expect(requestedMedia(paramsOf("/x?mediaKind=image"))).toBeNull();
  });

  it("keeps the media through the new ad route", () => {
    expect(newRouteTarget(paramsOf("/dashboard/advertising/new?media=m-1&mediaKind=image"))).toBe("/dashboard/advertising?create=1&media=m-1&mediaKind=image");
  });

  it("names the params the manager clears once the dialog opened", () => {
    expect(CREATE_MEDIA_PARAMS).toEqual(["media", "mediaKind"]);
  });
});
