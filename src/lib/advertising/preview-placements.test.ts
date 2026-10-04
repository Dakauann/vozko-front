import { describe, expect, it } from "vitest";

import { PREVIEW_PLACEMENTS, placementText, placementsFor } from "./preview-placements";

const ids = (specs: { id: string }[]) => specs.map((spec) => spec.id);

describe("placementsFor", () => {
  it("shows every placement Meta previews, feeds first like Meta's grid", () => {
    expect(ids(placementsFor("all", "IMAGE"))).toEqual(ids(PREVIEW_PLACEMENTS));
    expect(ids(placementsFor("all", "IMAGE")).slice(0, 2)).toEqual(["facebook_feed", "instagram_feed"]);
  });

  it("narrows to the group picked in the placement filter", () => {
    expect(ids(placementsFor("feeds", "IMAGE"))).toEqual(["facebook_feed", "instagram_feed", "facebook_marketplace"]);
    expect(ids(placementsFor("vertical", undefined))).toEqual(["facebook_story", "instagram_story", "instagram_reels", "facebook_reels"]);
  });

  it("leaves out placements a format cannot run on", () => {
    expect(ids(placementsFor("all", "COLLECTION"))).toEqual(["facebook_feed", "instagram_feed"]);
    expect(ids(placementsFor("vertical", "CAROUSEL"))).toEqual(["facebook_story", "instagram_story"]);
  });
});

describe("placementText", () => {
  const text = "CRM com WhatsApp oficial, IA e funis num só lugar. Atenda mais, organize vendas e pare de perder lead no caso do chat.";

  it("cuts Instagram captions much earlier than the Facebook feed", () => {
    const [facebook, instagram] = PREVIEW_PLACEMENTS;
    expect(placementText(facebook, text)).toEqual({ text, clipped: false });
    const caption = placementText(instagram, text);
    expect(caption.clipped).toBe(true);
    expect(caption.text.length).toBeLessThanOrEqual(85);
  });

  it("keeps Reels to a single short line", () => {
    const reels = PREVIEW_PLACEMENTS.find((spec) => spec.id === "instagram_reels")!;
    expect(placementText(reels, text).text.length).toBeLessThanOrEqual(40);
  });
});
