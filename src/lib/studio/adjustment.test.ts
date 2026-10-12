import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { adjustmentClipIssue, adjustmentLaneProperties, cameraAt, cameraPose, cameraStaticPatch, cameraView } from "./adjustment";
import { cameraContent, cameraSourcePoint, dosedCamera, isNeutralCamera, NEUTRAL_CAMERA, type ClipCamera } from "./clip-camera";
import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "./document";
import { keyableProperties, laneProperties, propertyValue } from "./keyframe-edit";
import { boxMap } from "./motion-blur";
import { visualPlan } from "./playback";
import { blurredPlan } from "./blurred-plan";
import { videoScene } from "./scene/video-scene";
import { documentIssue } from "./validate";
import { newEffectClip, newVfx } from "./vfx";
import { newMask } from "./masks";

const FIXTURE = resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_adjustment.json");
const CANVAS = { width: 1920, height: 1080 };

function adjustment(extra: Partial<Clip> = {}): Clip {
  return { ...newEffectClip([], 0, 2000), id: "fx", ...extra };
}

function film(clips: Clip[]): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  doc.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "film", 0, 2000), id: "shot" }] },
    { id: "v2", kind: "visual", clips },
  ];
  doc.durationMs = 2000;
  return doc;
}

describe("adjustment clip document", () => {
  it("accepts the shared fixture with the full color stack, blur, a keyed camera, masks and motion blur", () => {
    expect(documentIssue("video", JSON.parse(readFileSync(FIXTURE, "utf8")))).toBeNull();
  });

  it("takes color, gradient map, blur, camera, masks and motion blur, each validated", () => {
    expect(adjustmentClipIssue(adjustment({ color: { exposure: 1, curves: { master: [{ x: 0, y: 0.1 }, { x: 1, y: 1 }] }, lut: { assetId: "look" } }, gradientMap: { stops: [{ at: 0, color: "#000000" }, { at: 1, color: "#ffffff" }], intensity: 1 }, blur: 4, camera: { panX: 0.2, panY: 0, zoom: 2, rotation: 10 }, motionBlur: true, masks: [newMask("ellipse", "m")] }))).toBeNull();
    expect(adjustmentClipIssue(adjustment({ color: { exposure: 9 } }))).toBe("out_of_range");
    expect(adjustmentClipIssue(adjustment({ blur: 101 }))).toBe("out_of_range");
    expect(adjustmentClipIssue(adjustment({ camera: { panX: 0, panY: 0, zoom: 0.05, rotation: 0 } }))).toBe("out_of_range");
    expect(adjustmentClipIssue(adjustment({ camera: { panX: 3, panY: 0, zoom: 1, rotation: 0 } }))).toBe("out_of_range");
    expect(adjustmentClipIssue(adjustment({ masks: [{ ...newMask("ellipse", "m"), feather: 2 }] }))).not.toBeNull();
  });

  it("keys only blur, the grade sliders and the camera", () => {
    const keys = (property: string) => adjustment({ keyframes: { [property]: [{ atMs: 0, value: 1, easing: "linear" }, { atMs: 1000, value: 1.5, easing: "linear" }] } });
    for (const property of ["blur", "exposure", "cameraZoom", "cameraPanX", "cameraRotation"]) expect(adjustmentClipIssue(keys(property))).toBeNull();
    for (const property of ["x", "scale", "opacity", "gainDb", "speed"]) expect(adjustmentClipIssue(keys(property))).toBe("invalid");
    expect(adjustmentClipIssue(keys("cameraZoom"))).toBeNull();
    expect(adjustmentClipIssue(adjustment({ keyframes: { cameraZoom: [{ atMs: 0, value: 20, easing: "linear" }] } }))).toBe("out_of_range");
  });

  it("refuses a camera on any other clip and still refuses media and transforms on the adjustment", () => {
    const shot: Clip = { ...newMediaClip("video", "film", 0, 2000), id: "s", camera: { panX: 0, panY: 0, zoom: 2, rotation: 0 } };
    expect(documentIssue("video", film([shot]))).toEqual({ field: "document.tracks", code: "invalid" });
    const keyed: Clip = { ...newMediaClip("video", "film", 0, 2000), id: "s", keyframes: { cameraZoom: [{ atMs: 0, value: 2, easing: "linear" }] } };
    expect(documentIssue("video", film([keyed]))).toEqual({ field: "document.tracks", code: "invalid" });
    expect(adjustmentClipIssue(adjustment({ assetId: "film" }))).toBe("invalid");
    expect(adjustmentClipIssue(adjustment({ transform: { x: 0.4, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 } }))).toBe("invalid");
    expect(adjustmentClipIssue(adjustment({ chromaKey: { color: "#00ff00", similarity: 0.4, smoothness: 0.1, spill: 0.1 } }))).toBe("invalid");
  });
});

describe("2D camera math", () => {
  const camera: ClipCamera = { panX: 0.1, panY: -0.2, zoom: 2, rotation: 30 };

  it("puts the point it looks at in the middle and maps frame points back through the inverse", () => {
    const content = cameraContent(camera, CANVAS);
    const looked = { x: 0.5 + camera.panX, y: 0.5 + camera.panY };
    const back = cameraSourcePoint(camera, CANVAS, 0.5, 0.5);
    expect(back.x).toBeCloseTo(looked.x, 9);
    expect(back.y).toBeCloseTo(looked.y, 9);
    expect(content.w).toBe(2);
    expect(content.rotation).toBe(30);
    const map = boxMap({ x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 }, content, CANVAS)!;
    for (const [u, v] of [[0.2, 0.3], [0.8, 0.9], [0.5, 0.5]]) {
      const source = cameraSourcePoint(camera, CANVAS, u, v);
      expect(map[0] * u + map[1] * v + map[2]).toBeCloseTo(source.x, 9);
      expect(map[3] * u + map[4] * v + map[5]).toBeCloseTo(source.y, 9);
    }
  });

  it("doses toward no camera with the strength and the fades", () => {
    expect(isNeutralCamera(dosedCamera(camera, 0))).toBe(true);
    expect(dosedCamera(camera, 0.5)).toEqual({ panX: 0.05, panY: -0.1, zoom: 1.5, rotation: 15 });
    const faded = adjustment({ camera, fadeInMs: 1000 });
    expect(cameraPose(faded, 500, CANVAS)).toEqual(cameraContent(dosedCamera(camera, 0.5), CANVAS));
    expect(cameraPose(adjustment(), 500, CANVAS)).toBeNull();
  });

  it("reads keys over the static camera and drops a neutral camera when edited back", () => {
    const keyed = adjustment({ camera, keyframes: { cameraZoom: [{ atMs: 0, value: 1, easing: "linear" }, { atMs: 1000, value: 3, easing: "linear" }] } });
    expect(cameraAt(keyed, 500)).toEqual({ ...camera, zoom: 2 });
    expect(propertyValue(keyed, "cameraZoom", 500)).toBe(2);
    expect(propertyValue(keyed, "cameraPanX", 500)).toBe(0.1);
    expect(cameraStaticPatch(adjustment({ camera: { ...NEUTRAL_CAMERA, zoom: 2 } }), "cameraZoom", 1)).toEqual({ camera: undefined });
  });

  it("gives effect clips lanes for blur, the camera once it is used and keyed grade sliders", () => {
    expect(laneProperties(adjustment())).toEqual(["blur"]);
    expect(adjustmentLaneProperties(adjustment({ camera }))).toEqual(["blur", "cameraPanX", "cameraPanY", "cameraZoom", "cameraRotation"]);
    expect(keyableProperties(adjustment())).toContain("exposure");
  });
});

describe("adjustment clips in playback and the scene", () => {
  it("hands the color, blur, masks and the camera map of the moment to the effect node", () => {
    const fx = adjustment({ color: { contrast: 20 }, blur: 3, masks: [newMask("ellipse", "m")], camera: { panX: 0, panY: 0, zoom: 2, rotation: 0 }, vfx: [newVfx("vignette", "v", 0)] });
    const doc = film([fx]);
    const scene = videoScene(doc, visualPlan(doc, 500));
    const node = scene.nodes.find((n) => n.id === "fx")!;
    expect(node).toMatchObject({ grade: { contrast: 20 }, blurPx: 3, clipMasks: [expect.objectContaining({ id: "m" })] });
    expect(node.camera?.maps).toEqual(cameraView(fx, 500, CANVAS)!.maps);
    expect(node.camera?.box).toEqual({ x: 960, y: 540, width: 1920, height: 1080, rotation: 0 });
  });

  it("samples a moving camera across the shutter when motion blur is on, and keeps one map when it is off", () => {
    const moving = adjustment({ motionBlur: true, keyframes: { cameraPanX: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 0.5, easing: "linear" }] } });
    const blurred = blurredPlan(film([moving]), 500, 1).find((item) => item.clipId === "fx")!;
    expect(blurred.camera!.maps.length / 6).toBeGreaterThan(2);
    const sharp = blurredPlan(film([{ ...moving, motionBlur: undefined }]), 500, 1).find((item) => item.clipId === "fx")!;
    expect(sharp.camera!.maps.length).toBe(6);
  });
});
