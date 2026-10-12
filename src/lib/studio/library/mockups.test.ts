import { describe, expect, it } from "vitest";

import { emptyArtboard, emptyVideoDocument, newMediaClip, type VideoDocument } from "../document";
import { fillFrame, fillTargetAt } from "../frame-fill";
import { findClip, placeClips } from "../timeline";
import { documentIssue, surfaceIssue } from "../validate";
import { MOCKUPS_CATEGORY } from "./builtin/mockups";
import { isPlaceholderSlot } from "./frame-shapes";
import { frameWithItem, framesItem } from "./framing";
import { imageContent, insertImageContent, type LibraryRequest } from "./instantiate";
import type { LibraryItem } from "./model";
import { loadItems } from "./store";

const SQUARE = { width: 1080, height: 1080 };
const BRANDS = /iphone|ipad|macbook|apple|samsung|galaxy|pixel|instagram|facebook|tiktok|whatsapp|chrome|safari/i;

function request(canvas = SQUARE): LibraryRequest {
  return { canvas, locale: "pt", text: () => "" };
}

async function mockups(): Promise<readonly LibraryItem[]> {
  return loadItems(MOCKUPS_CATEGORY);
}

function withPhoto(type: "image" | "video" | "audio" = "image"): { doc: VideoDocument; clipId: string } {
  const placed = placeClips(emptyVideoDocument("square"), [newMediaClip(type, "photo", 0, 4000)])!;
  return { doc: placed.document, clipId: placed.ids[0] };
}

describe("mockups", () => {
  it("are generic devices and social frames with no brand in their words", async () => {
    const items = await mockups();
    expect(items.map((item) => item.id)).toEqual(["mockup-phone", "mockup-tablet", "mockup-laptop", "mockup-browser", "mockup-post", "mockup-story"]);
    for (const item of items) {
      expect(framesItem(item), item.id).toBe(true);
      const words = ["text" in item.label ? Object.values(item.label.text) : [], ...Object.values(item.tags ?? {})].flat();
      for (const word of words) expect(BRANDS.test(word), `${item.id}: ${word}`).toBe(false);
    }
  });

  it("insert in the image editor as a device group with one empty screen a photo drops into", async () => {
    for (const item of await mockups()) {
      const content = imageContent(item, request())!;
      const slots = content.layers.filter(isPlaceholderSlot);
      expect(slots, item.id).toHaveLength(1);
      expect(content.groups?.[0].baseId, item.id).not.toBe(slots[0].id);
      const board = insertImageContent({ ...emptyArtboard(SQUARE), layers: [] }, content).document;
      expect(surfaceIssue(board), item.id).toBeNull();
      const screen = board.layers.find(isPlaceholderSlot)!;
      const target = fillTargetAt(board, { x: screen.transform.x * SQUARE.width, y: screen.transform.y * SQUARE.height });
      expect(target?.frameId, item.id).toBe(screen.id);
      const filled = fillFrame(board, target!, "photo", { width: 800, height: 1200 });
      expect(filled.ok, item.id).toBe(true);
      if (filled.ok) expect(surfaceIssue(filled.document), item.id).toBeNull();
    }
  });

  it("put the selected video or photo clip on the screen in the video editor, with the device above it for the same time", async () => {
    for (const item of await mockups()) {
      const { doc, clipId } = withPhoto();
      const framed = frameWithItem(doc, item, [clipId]);
      expect(framed?.ok, item.id).toBe(true);
      if (!framed?.ok) continue;
      expect(documentIssue("video", framed.document), item.id).toBeNull();
      const photo = findClip(framed.document, clipId)!;
      const slot = imageContent(item, request())!.layers.find(isPlaceholderSlot)!;
      expect(photo.clip.transform.w, item.id).toBeCloseTo(slot.transform.w, 5);
      expect(photo.clip.transform.h, item.id).toBeCloseTo(slot.transform.h, 5);
      expect(photo.clip.fit, item.id).toBe("cover");
      const parts = framed.ids.slice(1).map((id) => findClip(framed.document, id)!);
      expect(parts.length, item.id).toBeGreaterThan(0);
      const photoTrack = framed.document.tracks.indexOf(photo.track);
      for (const part of parts) {
        expect(part.clip.startMs, item.id).toBe(photo.clip.startMs);
        expect(part.clip.durationMs, item.id).toBe(photo.clip.durationMs);
        expect(framed.document.tracks.indexOf(part.track), item.id).toBeGreaterThan(photoTrack);
      }
      expect(new Set(parts.map((part) => part.clip.linkId)).size, item.id).toBe(1);
    }
  });

  it("round the screen of devices with rounded screens through a mask", async () => {
    const phone = (await mockups()).find((item) => item.id === "mockup-phone")!;
    const { doc, clipId } = withPhoto("video");
    const framed = frameWithItem(doc, phone, [clipId]);
    expect(framed?.ok).toBe(true);
    if (framed?.ok) expect(findClip(framed.document, clipId)!.clip.masks?.[0].shape).toBe("rectangle");
  });

  it("refuse without one media clip", async () => {
    const phone = (await mockups()).find((item) => item.id === "mockup-phone")!;
    const { doc } = withPhoto();
    expect(frameWithItem(doc, phone, [])).toEqual({ ok: false, reason: "noClips" });
    const second = placeClips(doc, [newMediaClip("image", "other", 0, 4000)])!;
    const both = second.document.tracks.flatMap((track) => track.clips.map((clip) => clip.id));
    expect(frameWithItem(second.document, phone, both)).toEqual({ ok: false, reason: "tooMany", count: 1 });
    const audio = withPhoto("audio");
    expect(frameWithItem(audio.doc, phone, [audio.clipId])).toEqual({ ok: false, reason: "notMedia" });
  });
});
