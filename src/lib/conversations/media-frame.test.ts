import { describe, expect, it } from "vitest";

import { mediaFrame } from "./media-frame";

describe("mediaFrame", () => {
  it("keeps the real aspect ratio inside the bubble limits", () => {
    expect(mediaFrame("image", { width: 1600, height: 1200 })).toEqual({ width: 280, height: 210, fit: "contain" });
    expect(mediaFrame("image", { width: 1080, height: 1920 })).toEqual({ width: 203, height: 360, fit: "contain" });
    expect(mediaFrame("video", { width: 1920, height: 1080 })).toEqual({ width: 280, height: 158, fit: "contain" });
  });

  it("never enlarges a small picture", () => {
    expect(mediaFrame("image", { width: 200, height: 150 })).toEqual({ width: 200, height: 150, fit: "contain" });
  });

  it("gives extreme panoramas a usable box and crops them", () => {
    expect(mediaFrame("image", { width: 4000, height: 200 })).toEqual({ width: 280, height: 96, fit: "cover" });
    expect(mediaFrame("image", { width: 60, height: 3000 })).toEqual({ width: 96, height: 360, fit: "cover" });
  });

  it("uses one stable box when the size is unknown or unusable", () => {
    expect(mediaFrame("image")).toEqual({ width: 240, height: 240, fit: "cover" });
    expect(mediaFrame("image", { width: 0, height: 0 })).toEqual({ width: 240, height: 240, fit: "cover" });
    expect(mediaFrame("video")).toEqual({ width: 280, height: 158, fit: "cover" });
    expect(mediaFrame("sticker")).toEqual({ width: 160, height: 160, fit: "contain" });
  });
});
