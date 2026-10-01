import { describe, expect, it } from "vitest";

import { adOriginOf } from "./ad-origin";

describe("adOriginOf", () => {
  it("reads the ad the server attached to the conversation", () => {
    expect(
      adOriginOf({
        adId: "120200",
        platform: "instagram",
        title: "Promoção de outubro",
        sourceUrl: "https://www.instagram.com/p/abc",
        image: { url: "https://cdn/ad.jpg", layout: { width: 800, height: 800 } },
        arrivedAt: "2026-10-01T12:00:00Z",
      }),
    ).toEqual({
      platform: "instagram",
      title: "Promoção de outubro",
      sourceUrl: "https://www.instagram.com/p/abc",
      imageUrl: "https://cdn/ad.jpg",
    });
  });

  it("keeps an ad without a title or picture", () => {
    expect(adOriginOf({ adId: "9" })).toEqual({ platform: null, title: null, sourceUrl: null, imageUrl: null });
  });

  it("ignores anything that is not an ad", () => {
    expect(adOriginOf(null)).toBeNull();
    expect(adOriginOf("ad")).toBeNull();
    expect(adOriginOf({})).toBeNull();
  });

  it("only links to web addresses", () => {
    expect(adOriginOf({ adId: "1", sourceUrl: "javascript:alert(1)" })?.sourceUrl).toBeNull();
    expect(adOriginOf({ adId: "1", image: { url: "data:text/html,x" } })?.imageUrl).toBeNull();
  });
});
