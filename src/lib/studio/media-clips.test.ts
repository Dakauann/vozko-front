import { describe, expect, it } from "vitest";

import { newShapeLayer, STUDIO_LIMITS } from "./document";
import { captionClip, clipTypeForMedia, DEFAULT_STILL_MS, mediaClipDuration, mediaClips, overlayClip } from "./media-clips";
import { layerIssue } from "./validate";

describe("media clips", () => {
  it("maps library media types to clip types", () => {
    expect(clipTypeForMedia("video")).toBe("video");
    expect(clipTypeForMedia("vsl_video")).toBe("video");
    expect(clipTypeForMedia("image")).toBe("image");
    expect(clipTypeForMedia("audio")).toBe("audio");
    expect(clipTypeForMedia("document_pdf")).toBeNull();
  });

  it("uses the source length, a still default and the timeline limit", () => {
    expect(mediaClipDuration("image", 9000)).toBe(DEFAULT_STILL_MS);
    expect(mediaClipDuration("video", 4321.7)).toBe(4322);
    expect(mediaClipDuration("audio", undefined)).toBe(DEFAULT_STILL_MS);
    expect(mediaClipDuration("audio", 600_000)).toBe(STUDIO_LIMITS.maxVideoMs);
  });

  it("brings the sound of a video along as an audio clip", () => {
    const [video, sound] = mediaClips("video", "vid", 1000, 5000);
    expect(video).toMatchObject({ type: "video", assetId: "vid", startMs: 1000, durationMs: 5000, fit: "cover" });
    expect(sound).toMatchObject({ type: "audio", assetId: "vid", startMs: 1000, durationMs: 5000 });
    expect(video.linkId).toBeTruthy();
    expect(sound.linkId).toBe(video.linkId);
    expect(mediaClips("image", "img", 0, undefined)).toHaveLength(1);
  });

  it("keeps the layer box as the overlay transform", () => {
    const layer = newShapeLayer("arrow");
    const clip = overlayClip(layer, 500);
    expect(clip.transform).toEqual(layer.transform);
    expect(clip.layer?.transform).toEqual({ x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 });
  });

  it("builds readable caption overlays the backend accepts", () => {
    const clip = captionClip({ text: "Olá", startMs: 1000, endMs: 2500 });
    expect(clip).toMatchObject({ type: "overlay", startMs: 1000, durationMs: 1500 });
    expect(layerIssue(clip.layer!)).toBeNull();
  });
});
