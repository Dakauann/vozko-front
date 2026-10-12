import { describe, expect, it } from "vitest";

import { emptyVideoDocument } from "../document";
import { visualPlan } from "../playback";
import { TRANSPARENT_BACKGROUND, videoScene, withTransparencyGrid } from "./video-scene";

describe("transparency grid view", () => {
  it("clears the film background so the grid shows where nothing covers the frame", () => {
    const doc = emptyVideoDocument("square", "#336699");
    const scene = videoScene(doc, visualPlan(doc, 0));
    expect(withTransparencyGrid(scene, true)).toEqual({ ...scene, background: TRANSPARENT_BACKGROUND });
    expect(withTransparencyGrid(scene, false)).toBe(scene);
    expect(TRANSPARENT_BACKGROUND).toMatch(/^#[0-9a-f]{6}00$/);
  });
});
