import { describe, expect, it } from "vitest";

import { clipKeySample, detectKeyColor, keyMoment, keySampleId, layerKeySource } from "./chroma-detect";
import { newImageLayer, newMediaClip, newOverlayClip, newTextLayer } from "./document";
import { chromaPixel, newChromaKey } from "./chroma-key";

type Rgb = readonly [number, number, number];

function frame(width: number, height: number, paint: (x: number, y: number) => Rgb): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set([...paint(x, y), 255], (y * width + x) * 4);
  return data;
}

function hexOf(rgb: Rgb): string {
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function subjectInMiddle(screen: Rgb, subject: Rgb = [200, 160, 140]) {
  return (x: number, y: number): Rgb => (x > 20 && x < 80 && y > 15 && y < 85 ? subject : screen);
}

describe("automatic key color", () => {
  it("finds a green screen around a subject", () => {
    expect(detectKeyColor(frame(100, 100, subjectInMiddle([40, 190, 70])), 100, 100)).toBe(hexOf([40, 190, 70]));
  });

  it("finds a blue screen", () => {
    expect(detectKeyColor(frame(100, 100, subjectInMiddle([20, 90, 210])), 100, 100)).toBe(hexOf([20, 90, 210]));
  });

  it("takes the dominant shade when the screen is unevenly lit", () => {
    const uneven = (x: number, y: number): Rgb => (x > 20 && x < 80 && y > 15 && y < 85 ? [200, 160, 140] : y < 8 ? [30, 120, 50] : [40, 190, 70]);
    expect(detectKeyColor(frame(100, 100, uneven), 100, 100)).toBe(hexOf([40, 190, 70]));
  });

  it("still finds a screen lit as a gradient whose shades spread over many bins", () => {
    const gradient = (x: number, y: number): Rgb => (x > 20 && x < 80 && y > 15 && y < 85 ? [200, 160, 140] : [20 + Math.round(y * 0.4), 110 + Math.round(y * 1.2), 40 + Math.round(y * 0.5)]);
    const found = detectKeyColor(frame(100, 100, gradient), 100, 100);
    expect(found).not.toBeNull();
    const key = newChromaKey(found!);
    const keyedBorder = [0, 30, 60, 99].filter((y) => chromaPixel(key, gradient(0, y).map((v) => v / 255) as unknown as Rgb).alpha === 0);
    expect(keyedBorder.length).toBeGreaterThanOrEqual(3);
  });

  it("ignores a subject that reaches the border when most of the border is screen", () => {
    const touching = (x: number, y: number): Rgb => (x > 30 && x < 70 && y > 15 ? [200, 160, 140] : [40, 190, 70]);
    expect(detectKeyColor(frame(100, 100, touching), 100, 100)).toBe(hexOf([40, 190, 70]));
  });

  it("finds nothing in a photo without a green or blue screen", () => {
    expect(detectKeyColor(frame(100, 100, subjectInMiddle([128, 128, 128])), 100, 100)).toBeNull();
    expect(detectKeyColor(frame(100, 100, subjectInMiddle([220, 40, 40])), 100, 100)).toBeNull();
    const mixed = (x: number): Rgb => (x < 40 ? [40, 190, 70] : [230, 220, 200]);
    expect(detectKeyColor(frame(100, 100, mixed), 100, 100)).toBeNull();
  });

  it("skips transparent pixels and answers nothing for an empty picture", () => {
    expect(detectKeyColor(new Uint8ClampedArray(16 * 16 * 4), 16, 16)).toBeNull();
    expect(detectKeyColor(new Uint8ClampedArray(0), 0, 0)).toBeNull();
  });
});

describe("where the key color is sampled", () => {
  const clip = { ...newMediaClip("video", "m-green", 1000, 4000), id: "c", trimInMs: 2000 };

  it("samples the moment asked, else the playhead inside the clip, else the first frame", () => {
    expect(keyMoment(clip, 500, 0)).toBe(500);
    expect(keyMoment(clip, undefined, 3000)).toBe(2000);
    expect(keyMoment(clip, undefined, 9000)).toBe(0);
    expect(keyMoment(clip, 99_000, 0)).toBe(clip.durationMs);
  });

  it("reads the source frame of a video and the still of an image, and nothing for other clips", () => {
    expect(clipKeySample(clip, 500)).toEqual({ assetId: "m-green", sourceMs: 2500, still: false });
    expect(clipKeySample({ ...clip, speed: 2 }, 500)).toEqual({ assetId: "m-green", sourceMs: 3000, still: false });
    expect(clipKeySample({ ...newMediaClip("image", "m-photo", 0, 3000), id: "i" }, 1200)).toEqual({ assetId: "m-photo", sourceMs: 0, still: true });
    expect(clipKeySample({ ...newOverlayClip(newTextLayer("Oi"), 0, 1000), id: "t" }, 0)).toBeNull();
    expect(keySampleId({ assetId: "m-green", sourceMs: 2500, still: false })).not.toBe(keySampleId({ assetId: "m-green", sourceMs: 2000, still: false }));
  });

  it("names an image layer source by its picture and crop", () => {
    const photo = newImageLayer("m-photo");
    const twin = { ...newImageLayer("m-photo"), name: "twin" };
    expect(layerKeySource(photo)).toBe(layerKeySource(twin));
    expect(layerKeySource({ ...photo, crop: { x: 0.1, y: 0, w: 0.5, h: 1 } })).not.toBe(layerKeySource(photo));
    expect(layerKeySource(newTextLayer("Oi"))).toBeNull();
  });
});
