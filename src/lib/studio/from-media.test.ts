import { describe, expect, it } from "vitest";

import { closestImagePreset, projectNameFrom, closestVideoAspect, imageDocumentFromMedia, studioKindForMedia, videoDocumentFromMedia } from "./from-media";
import { parseDocument } from "./validate";

const asset = "11111111-1111-4111-8111-111111111111";

describe("opening a generated media in the studio", () => {
  it("picks the studio by media type and refuses the rest", () => {
    expect(studioKindForMedia("image")).toBe("image");
    expect(studioKindForMedia("video")).toBe("video");
    expect(studioKindForMedia("audio")).toBe("video");
    expect(studioKindForMedia("document")).toBeNull();
  });

  it("picks the canvas closest to the media shape", () => {
    expect(closestImagePreset({ width: 1024, height: 1024 }).id).toBe("instagram_post");
    expect(closestImagePreset({ width: 720, height: 1280 }).id).toBe("instagram_story");
    expect(closestImagePreset({ width: 1600, height: 900 }).id).toBe("youtube_thumbnail");
    expect(closestImagePreset({ width: 1910, height: 1000 }).id).toBe("facebook_link");
    expect(closestImagePreset({ width: 1000, height: 1500 }).id).toBe("pinterest_pin");
    expect(closestVideoAspect({ width: 1080, height: 1350 })).toBe("portrait");
    expect(closestVideoAspect({ width: 1920, height: 1080 })).toBe("landscape");
  });

  it("places an image whole on its canvas, as one editable layer", () => {
    const doc = imageDocumentFromMedia(asset, { width: 1200, height: 800 });
    const [artboard] = doc.artboards;
    expect(artboard.canvas).toMatchObject({ width: 1280, height: 720 });
    const [layer] = artboard.layers;
    expect(layer).toMatchObject({ type: "image", assetId: asset });
    expect(layer.transform.h).toBeCloseTo(1);
    expect(layer.transform.w).toBeLessThanOrEqual(1);
    expect(parseDocument("image", JSON.parse(JSON.stringify(doc))).ok).toBe(true);
  });

  it("opens a video with its sound as a linked clip and the right length", () => {
    const doc = videoDocumentFromMedia("video", asset, { width: 1080, height: 1920, durationMs: 8_000 });
    expect(doc?.canvas.aspect).toBe("story");
    expect(doc?.durationMs).toBe(8_000);
    const types = doc?.tracks.flatMap((t) => t.clips.map((c) => `${t.kind}:${c.type}`)).sort();
    expect(types).toEqual(["audio:audio", "visual:video"]);
    expect(parseDocument("video", JSON.parse(JSON.stringify(doc))).ok).toBe(true);
  });

  it("opens a sound alone on an audio track", () => {
    const doc = videoDocumentFromMedia("audio", asset, { width: 0, height: 0, durationMs: 12_000 });
    expect(doc?.tracks.flatMap((t) => t.clips.map((c) => `${t.kind}:${c.type}`))).toEqual(["audio:audio"]);
    expect(doc?.durationMs).toBe(12_000);
  });

  it("names the project after the media, within the name limit", () => {
    expect(projectNameFrom("  um card  ", "Criativo")).toBe("um card");
    expect(projectNameFrom("   ", "Criativo")).toBe("Criativo");
    expect(Array.from(projectNameFrom("é".repeat(300), "x"))).toHaveLength(120);
  });
});
