import { describe, expect, it } from "vitest";

import { NEW_IMAGE_PRESET, NEW_VIDEO_ASPECT, studioProjectDocument, type ProjectMedia } from "./from-media";
import { IMAGE_PRESETS, type ImageDocument, type VideoDocument } from "./document";
import { parseDocument } from "./validate";

const photo: ProjectMedia = { mediaId: "11111111-1111-4111-8111-111111111111", type: "image", frame: { width: 1080, height: 1350 } };
const logo: ProjectMedia = { mediaId: "22222222-2222-4222-8222-222222222222", type: "image", frame: { width: 500, height: 500 } };
const clip: ProjectMedia = { mediaId: "33333333-3333-4333-8333-333333333333", type: "video", frame: { width: 1080, height: 1920, durationMs: 6000 } };
const song: ProjectMedia = { mediaId: "44444444-4444-4444-8444-444444444444", type: "audio", frame: { width: 0, height: 0, durationMs: 30000 } };

function valid(kind: "image" | "video", document: unknown): boolean {
  return parseDocument(kind, JSON.parse(JSON.stringify(document))).ok;
}

describe("one builder for every new studio project", () => {
  it("makes the same empty image project as the new project dialog", () => {
    const result = studioProjectDocument({ kind: "image" });
    if (!result.ok) throw new Error(result.issue);
    const doc = result.document as ImageDocument;
    const preset = IMAGE_PRESETS.find((p) => p.id === NEW_IMAGE_PRESET)!;
    expect(doc.artboards).toHaveLength(1);
    expect(doc.artboards[0].canvas).toMatchObject({ width: preset.width, height: preset.height });
    expect(doc.artboards[0].layers).toEqual([]);
    expect(valid("image", doc)).toBe(true);
  });

  it("makes the same empty video project as the new project dialog", () => {
    const result = studioProjectDocument({ kind: "video" });
    if (!result.ok) throw new Error(result.issue);
    const doc = result.document as VideoDocument;
    expect(doc.canvas.aspect).toBe(NEW_VIDEO_ASPECT);
    expect(doc.tracks.every((t) => t.clips.length === 0)).toBe(true);
    expect(valid("video", doc)).toBe(true);
  });

  it("puts the first photo on one artboard per placement size and the rest on the first", () => {
    const sizes = [{ width: 1440, height: 1800 }, { width: 1440, height: 2560 }, { width: 1080, height: 1080 }];
    const result = studioProjectDocument({ kind: "image", media: [photo, logo], sizes });
    if (!result.ok) throw new Error(result.issue);
    const doc = result.document as ImageDocument;
    expect(doc.artboards.map((a) => [a.canvas.width, a.canvas.height])).toEqual(sizes.map((s) => [s.width, s.height]));
    expect(doc.artboards.map((a) => a.layers.length)).toEqual([2, 1, 1]);
    expect(doc.artboards.every((a) => a.layers[0].type === "image" && a.layers[0].assetId === photo.mediaId)).toBe(true);
    const story = doc.artboards[1].layers[0].transform;
    expect(story.w).toBeCloseTo(1);
    expect(story.h).toBeLessThan(1);
    const boxes = doc.artboards.map((a) => `${a.x},${a.y}`);
    expect(new Set(boxes).size).toBe(3);
    expect(valid("image", doc)).toBe(true);
  });

  it("lines up visual media on the timeline and lays the sound under them", () => {
    const result = studioProjectDocument({ kind: "video", media: [photo, clip, song], durationMs: 4000, aspect: "portrait" });
    if (!result.ok) throw new Error(result.issue);
    const doc = result.document as VideoDocument;
    const visual = doc.tracks.flatMap((t) => t.clips.filter((c) => c.type !== "audio"));
    expect(visual.map((c) => [c.type, c.startMs, c.durationMs])).toEqual([["image", 0, 4000], ["video", 4000, 6000]]);
    expect(doc.canvas.aspect).toBe("portrait");
    expect(valid("video", doc)).toBe(true);
  });

  it("refuses what the editor would refuse", () => {
    expect(studioProjectDocument({ kind: "image", sizes: [{ width: 50, height: 1080 }] })).toEqual({ ok: false, issue: "size" });
    expect(studioProjectDocument({ kind: "image", sizes: [{ width: 1080.5, height: 1080 }] })).toEqual({ ok: false, issue: "size" });
    expect(studioProjectDocument({ kind: "image", media: [clip] })).toEqual({ ok: false, issue: "media" });
    expect(studioProjectDocument({ kind: "image", aspect: "story" })).toEqual({ ok: false, issue: "aspect" });
    expect(studioProjectDocument({ kind: "image", durationMs: 3000 })).toEqual({ ok: false, issue: "duration" });
    expect(studioProjectDocument({ kind: "video", sizes: [{ width: 1080, height: 1080 }] })).toEqual({ ok: false, issue: "size" });
    expect(studioProjectDocument({ kind: "video", aspect: "cinema" as never })).toEqual({ ok: false, issue: "aspect" });
    expect(studioProjectDocument({ kind: "video", durationMs: 20 })).toEqual({ ok: false, issue: "duration" });
  });
});
