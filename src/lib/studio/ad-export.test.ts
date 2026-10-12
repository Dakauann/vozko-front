import { describe, expect, it } from "vitest";

import { adExportBlock, adExportRequest } from "./ad-export";

describe("adExportBlock", () => {
  it("lets one artboard in PNG or JPEG become an ad", () => {
    expect(adExportBlock("png", 1)).toBeNull();
    expect(adExportBlock("jpeg", 1)).toBeNull();
  });

  it("asks for a single artboard", () => {
    expect(adExportBlock("png", 3)).toBe("oneArtboard");
  });

  it("asks for a raster format the ad platform accepts", () => {
    expect(adExportBlock("svg", 1)).toBe("rasterOnly");
    expect(adExportBlock("pdf", 1)).toBe("rasterOnly");
    expect(adExportBlock("gif", 1)).toBe("rasterOnly");
  });
});

describe("adExportRequest", () => {
  it("never leaves a transparent background in an ad", () => {
    expect(adExportRequest({ format: "png", scale: 2, quality: 0.9, transparent: true })).toEqual({ format: "png", scale: 2, quality: 0.9, transparent: false });
  });
});
