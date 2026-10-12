import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { changedGrade, gradeIssue, isNeutralGrade, storedGrade, withExtras } from "./color-grade";
import { curvePresetPoints } from "./color-curves";
import { newMediaClip, newOverlayClip, newTextLayer, type Clip } from "./document";
import { gradeAt, gradeKeysIssue, gradeLaneProperties, gradeStaticPatch, keyedGradeFields } from "./grade-keys";
import { laneProperties, propertyValue, toggleAnimation } from "./keyframe-edit";
import { clipIssue, documentIssue } from "./validate";

function shot(extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip("video", "a", 0, 2000), ...extra };
}

describe("grade extras", () => {
  it("keeps curves, the secondary and the LUT through looks and merges, and drops neutral parts", () => {
    const curves = { master: curvePresetPoints("contrast") };
    const graded = changedGrade({ exposure: 1, curves, hsl: { hue: 0, width: 30, desaturate: 100 } }, { look: "warm" });
    expect(graded?.curves).toEqual(curves);
    expect(graded?.hsl?.desaturate).toBe(100);
    expect(graded?.exposure).toBeUndefined();
    expect(graded?.temperature).toBe(35);
    expect(changedGrade(graded, { extras: { curves: null, hsl: null } })).toEqual({ temperature: 35, tint: 5, vibrance: 10 });
    expect(storedGrade({ lut: { assetId: "look", intensity: 0 }, hsl: { hue: 10, width: 10 } })).toBeUndefined();
    expect(isNeutralGrade(withExtras({}, { lut: { assetId: "look" } }))).toBe(false);
    expect(gradeIssue({ curves: { red: [{ x: 0, y: 0 }] } })).toBe("invalid");
    expect(gradeIssue({ lut: { assetId: "" } })).toBe("required");
  });
});

describe("grade keys", () => {
  const keyed = shot({
    color: { contrast: 20, saturation: 10 },
    keyframes: {
      exposure: [
        { atMs: 0, value: -1, easing: "linear" },
        { atMs: 1000, value: 1, easing: "linear" },
      ],
      saturation: [
        { atMs: 0, value: -100, easing: "linear" },
        { atMs: 2000, value: 0, easing: "linear" },
      ],
    },
  });

  it("animates the keyed fields over the static grade", () => {
    expect(gradeAt(keyed, 500)).toEqual({ contrast: 20, saturation: -75 });
    expect(gradeAt(keyed, 1000)?.exposure).toBe(1);
    expect(gradeAt(keyed, 2000)).toEqual({ contrast: 20, exposure: 1 });
    expect(gradeAt(shot(), 0)).toBeUndefined();
    expect(keyedGradeFields(keyed)).toEqual(["exposure", "saturation"]);
  });

  it("shows keyed grade lanes and toggles a field off at the value under the playhead", () => {
    expect(laneProperties(keyed)).toEqual(expect.arrayContaining(gradeLaneProperties(keyed)));
    expect(propertyValue(keyed, "exposure", 250)).toBe(-0.5);
    const off = toggleAnimation(keyed, "exposure", 250, 1);
    expect(off.keyframes?.exposure).toBeUndefined();
    expect(off.color).toEqual({ contrast: 20, saturation: 10, exposure: -0.5 });
    expect(gradeStaticPatch(keyed, "contrast", 0)).toEqual({ color: { saturation: 10 } });
  });

  it("lives only on video and image clips", () => {
    expect(gradeKeysIssue(keyed)).toBeNull();
    const text = { ...newOverlayClip(newTextLayer("Oi"), 0, 1000), keyframes: keyed.keyframes };
    expect(gradeKeysIssue(text)).toBe("invalid");
    expect(clipIssue(text, "visual", 6000)).toBe("invalid");
    expect(clipIssue({ ...keyed, gradientMap: { stops: [{ at: 0, color: "#000000" }, { at: 1, color: "#ffffff" }], intensity: 1 } }, "visual", 6000)).toBeNull();
    expect(clipIssue({ ...text, keyframes: undefined, gradientMap: { stops: [{ at: 0, color: "#000000" }, { at: 1, color: "#ffffff" }], intensity: 1 } }, "visual", 6000)).toBe("invalid");
  });
});

describe("the color and speed contract shared with the backend", () => {
  it("accepts the fixture the backend accepts", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_color.json"), "utf8"));
    expect(documentIssue("video", raw)).toBeNull();
  });
});
