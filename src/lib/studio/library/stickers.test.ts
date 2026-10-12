import { describe, expect, it } from "vitest";

import { emptyArtboard, emptyVideoDocument, type Clip } from "../document";
import { surfaceIssue, documentIssue } from "../validate";
import { STICKERS_CATEGORY } from "./builtin/stickers";
import { imageContent, insertImageContent, insertVideoClips, videoClips, type LibraryRequest } from "./instantiate";
import type { LibraryItem } from "./model";
import { lastFrameMs, stickerStill } from "./sticker-still";

const SQUARE = { width: 1080, height: 1080 };
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

function request(canvas = SQUARE, extra: Partial<LibraryRequest> = {}): LibraryRequest {
  return { canvas, locale: "pt", text: (slot) => ("text" in slot.sample ? slot.sample.text.pt : slot.sample.key), ...extra };
}

const ITEMS = STICKERS_CATEGORY.items() as readonly LibraryItem[];

function durationOf(item: LibraryItem): number {
  return item.template.kind === "sticker" ? item.template.durationMs : 0;
}

describe("animated stickers", () => {
  it("are built from our own layers, in both editors, with words free of long dashes", () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(40);
    for (const item of ITEMS) {
      expect(item.template.kind, item.id).toBe("sticker");
      expect(item.editors, item.id).toEqual(["image", "video"]);
      const words = [...Object.values("text" in item.label ? item.label.text : {}), ...(item.template.slots ?? []).flatMap((slot) => ("text" in slot.sample ? Object.values(slot.sample.text) : []))];
      for (const word of words) expect(DASHES.test(word), `${item.id}: ${word}`).toBe(false);
    }
  });

  it("insert at the playhead as animated clips the video editor accepts", () => {
    const doc = ITEMS.reduce((current, item, index) => {
      const clips = videoClips(item, { ...request(), atMs: index * 3000, documentMs: current.durationMs })!;
      expect(clips.length, item.id).toBeGreaterThan(0);
      expect(clips.every((clip) => clip.startMs === index * 3000 && clip.durationMs === durationOf(item)), item.id).toBe(true);
      expect(clips.some((clip) => clip.keyframes || clip.textIn || clip.behaviors), item.id).toBe(true);
      if (clips.length > 1) expect(new Set(clips.map((clip) => clip.linkId)).size, item.id).toBe(1);
      return insertVideoClips(current, clips)!.document;
    }, emptyVideoDocument("square"));
    expect(documentIssue("video", doc)).toBeNull();
  });

  it("insert their final frame in the image editor on any artboard", () => {
    for (const canvas of [SQUARE, { width: 1080, height: 1920 }, { width: 2400, height: 1200 }]) {
      for (const item of ITEMS) {
        const content = imageContent(item, request(canvas));
        expect(content, `${item.id} on ${canvas.width}x${canvas.height}`).not.toBeNull();
        const board = insertImageContent({ ...emptyArtboard(canvas), layers: [] }, content!).document;
        expect(surfaceIssue(board), item.id).toBeNull();
        expect(content!.layers.every((layer) => layer.transform.opacity > 0.99), item.id).toBe(true);
      }
    }
  });

  it("the still equals the video clips at their last frame", () => {
    const item = ITEMS.find((candidate) => candidate.id === "sticker-word-new")!;
    const clips = videoClips(item, { ...request(), atMs: 0, documentMs: 0 })!;
    const still = stickerStill(clips, "square", lastFrameMs(durationOf(item)))!;
    const image = imageContent(item, request())!.layers;
    expect(image.map((layer) => [layer.type, layer.text, layer.fill])).toEqual(still.map((layer) => [layer.type, layer.text, layer.fill]));
    image.forEach((layer, i) => expect(layer.transform.w).toBeCloseTo(still[i].transform.w, 6));
  });

  it("stretches its animation to a longer length instead of cutting it", () => {
    const item = ITEMS.find((candidate) => candidate.id === "sticker-circle")!;
    const [clip] = videoClips(item, { ...request(), atMs: 0, documentMs: 0, durationMs: 6000 })! as Clip[];
    expect(clip.durationMs).toBe(6000);
    expect(clip.keyframes?.trimEnd?.at(-1)?.value).toBe(1);
  });

  it("puts the new words in each slot", () => {
    const item = ITEMS.find((candidate) => candidate.id === "sticker-word-thanks")!;
    const clips = videoClips(item, { ...request(), text: () => "VALEU", atMs: 0, documentMs: 0 })!;
    expect(clips.find((clip) => clip.layer?.type === "text")?.layer?.text).toBe("VALEU");
  });
});
