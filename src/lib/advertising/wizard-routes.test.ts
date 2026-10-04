import { describe, expect, it } from "vitest";

import type { AdsOptions } from "./draft-types";
import {
  callsToActionFor,
  canAddAd,
  destinationOf,
  dynamicCreative,
  flexibleAllowed,
  formatsFor,
  goalsFor,
  linkRequired,
  needsPixel,
  placementWarnings,
  resolvedCallToAction,
  routesFor,
  togglePlatform,
  togglePosition,
} from "./wizard-routes";

const options: AdsOptions = {
  objectives: [
    { objective: "OUTCOME_LEADS", routes: [{ destination: "ON_AD", goals: ["LEAD_GENERATION", "QUALITY_LEAD"] }] },
    { objective: "OUTCOME_SALES", routes: [{ destination: "CATALOG", goals: ["VALUE"] }] },
  ],
  callsToAction: ["LEARN_MORE", "SHOP_NOW"],
  destinationCallsToAction: {
    WHATSAPP: ["WHATSAPP_MESSAGE"],
    WEBSITE: ["LEARN_MORE", "SHOP_NOW"],
    APP: ["INSTALL_MOBILE_APP", "LEARN_MORE"],
  },
  placements: { facebook: ["feed", "story", "marketplace"] },
  breakdownGroups: null,
  attributionWindows: null,
  pixelEvents: ["PURCHASE"],
  formats: ["IMAGE"],
  videoOnlyPositions: {},
  automaticPlatforms: [],
};

describe("routes", () => {
  it("filters routes and goals by objective and destination", () => {
    const routes = routesFor(options, "OUTCOME_LEADS");
    expect(routes.map((route) => route.destination)).toEqual(["ON_AD"]);
    expect(goalsFor(routes, "ON_AD")).toEqual(["LEAD_GENERATION", "QUALITY_LEAD"]);
    expect(goalsFor(routes, "WEBSITE")).toEqual([]);
    expect(routesFor(null, "OUTCOME_LEADS")).toEqual([]);
    expect(routesFor(options, "")).toEqual([]);
  });

  it("reads a destination from a report row and rejects unknown ones", () => {
    expect(destinationOf("WHATSAPP")).toBe("WHATSAPP");
    expect(destinationOf("SOMETHING_NEW")).toBe("");
    expect(destinationOf(undefined)).toBe("");
  });

  it("needs a pixel for conversion goals except on catalog", () => {
    expect(needsPixel("VALUE", "WEBSITE")).toBe(true);
    expect(needsPixel("VALUE", "CATALOG")).toBe(false);
    expect(needsPixel("LINK_CLICKS", "WEBSITE")).toBe(false);
  });
});

describe("formats and calls to action", () => {
  it("mirrors the backend formats per destination", () => {
    expect(formatsFor("ON_POST")).toEqual(["EXISTING_POST"]);
    expect(formatsFor("CATALOG")).toEqual(["CATALOG", "COLLECTION"]);
    expect(formatsFor("WHATSAPP")).not.toContain("EXISTING_POST");
    expect(formatsFor("WEBSITE")).toContain("EXISTING_POST");
  });

  it("requires a link on website and catalog ads except carousels and posts", () => {
    expect(linkRequired("WEBSITE", "IMAGE")).toBe(true);
    expect(linkRequired("WEBSITE", "CAROUSEL")).toBe(false);
    expect(linkRequired("WHATSAPP", "IMAGE")).toBe(false);
  });

  it("offers link calls to action only where they apply", () => {
    expect(callsToActionFor("WHATSAPP", options.destinationCallsToAction)).toEqual([]);
    expect(callsToActionFor("APP", options.destinationCallsToAction)[0]).toBe("INSTALL_MOBILE_APP");
    expect(callsToActionFor("ON_AD", options.destinationCallsToAction)).toEqual([]);
    expect(resolvedCallToAction("WHATSAPP", "SHOP_NOW")).toBe("WHATSAPP_MESSAGE");
    expect(resolvedCallToAction("WEBSITE", "")).toBe("LEARN_MORE");
  });
});

describe("flexible format", () => {
  it("needs its own ad set outside Sales and App promotion", () => {
    expect(dynamicCreative("OUTCOME_LEADS", ["FLEXIBLE"])).toBe(true);
    expect(dynamicCreative("OUTCOME_SALES", ["FLEXIBLE"])).toBe(false);
    expect(flexibleAllowed("OUTCOME_LEADS", true, 1)).toBe(true);
    expect(flexibleAllowed("OUTCOME_LEADS", true, 2)).toBe(false);
    expect(flexibleAllowed("OUTCOME_LEADS", false, 1)).toBe(false);
    expect(flexibleAllowed("OUTCOME_SALES", false, 4)).toBe(true);
    expect(canAddAd("OUTCOME_LEADS", ["FLEXIBLE"])).toBe(false);
    expect(canAddAd("OUTCOME_SALES", ["FLEXIBLE"])).toBe(true);
    expect(canAddAd("OUTCOME_SALES", Array(10).fill("IMAGE"))).toBe(false);
  });
});

describe("placements", () => {
  it("toggles platforms with all of their positions", () => {
    const on = togglePlatform({ automatic: false }, "facebook", ["feed", "story"], true);
    expect(on).toEqual({ automatic: false, platforms: ["facebook"], positions: { facebook: ["feed", "story"] } });
    expect(togglePlatform(on, "facebook", [], false)).toEqual({ automatic: false, platforms: [], positions: {} });
  });

  it("drops positions that need the feed when the feed goes away", () => {
    const start = { automatic: false, platforms: ["facebook"], positions: { facebook: ["feed", "marketplace", "story"] } };
    expect(togglePosition(start, "facebook", "feed", false).positions).toEqual({ facebook: ["story"] });
    expect(
      togglePosition({ automatic: false, platforms: ["facebook"], positions: { facebook: ["feed"] } }, "facebook", "feed", false),
    ).toEqual({
      automatic: false,
      platforms: [],
      positions: {},
    });
  });

  it("warns about Meta placement rules", () => {
    expect(placementWarnings({ automatic: true }, "INSTAGRAM_DIRECT")).toEqual([]);
    expect(
      placementWarnings({ automatic: false, platforms: ["facebook"], positions: { facebook: ["story"] } }, "INSTAGRAM_DIRECT"),
    ).toEqual(["story_alone", "instagram_required"]);
    expect(placementWarnings({ automatic: false, platforms: ["audience_network"] }, "MESSENGER")).toEqual([
      "audience_network_alone",
      "facebook_required",
    ]);
    expect(placementWarnings({ automatic: false, platforms: [] }, "")).toEqual(["platforms_required"]);
  });
});
