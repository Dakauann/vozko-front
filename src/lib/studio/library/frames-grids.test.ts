import { describe, expect, it } from "vitest";

import { layoutSurface } from "../auto-layout";
import { emptyArtboard, emptyVideoDocument, newMediaClip, newOverlayClip, newShapeLayer, type VideoDocument } from "../document";
import { fillTargetAt } from "../frame-fill";
import { layoutsIssue } from "../auto-layout";
import { surfaceIssue } from "../validate";
import { FRAMES_CATEGORY } from "./builtin/frames";
import { GRIDS_CATEGORY } from "./builtin/grids";
import { containedBox, frameMask, frameSlotLayer } from "./frame-shapes";
import { frameWithItem, gridClips, mediaClipAt } from "./framing";
import { cellCount, cellNode, gridCells, gridLayers, splitNode } from "./grid-layout";
import { imageContent, insertImageContent, videoClips, type LibraryRequest } from "./instantiate";
import type { LibraryCategory, LibraryItem } from "./model";

const SQUARE = { width: 1000, height: 1000 };

function request(canvas = SQUARE, extra: Partial<LibraryRequest> = {}): LibraryRequest {
  return { canvas, locale: "pt", text: (slot) => ("text" in slot.sample ? slot.sample.text.pt : slot.sample.key), ...extra };
}

function itemsOf(category: LibraryCategory): readonly LibraryItem[] {
  return category.items() as readonly LibraryItem[];
}

function itemOf(category: LibraryCategory, id: string): LibraryItem {
  return itemsOf(category).find((item) => item.id === id)!;
}

function film(count: number): { doc: VideoDocument; ids: string[] } {
  const doc = emptyVideoDocument("landscape");
  const clips = Array.from({ length: count }, (_, i) => ({ ...newMediaClip("image", `photo-${i}`, 0, 2000), id: `clip-${i}` }));
  return { doc: { ...doc, durationMs: 2000, tracks: clips.map((clip, i) => ({ id: `track-${i}`, kind: "visual" as const, clips: [clip] })) }, ids: clips.map((clip) => clip.id) };
}

describe("frame shapes", () => {
  it("draws the same outline as a layer and as a clip mask", () => {
    const transform = { x: 0.5, y: 0.5, w: 0.4, h: 0.4, rotation: 0, opacity: 1 };
    expect(frameSlotLayer({ kind: "rect", radius: 0.3 }, transform)).toMatchObject({ type: "shape", shape: "rect", radius: 0.3, transform });
    expect(frameSlotLayer({ kind: "path", path: "M0 0 L1 0 L1 1 Z" }, transform)).toMatchObject({ shape: "path", path: "M0 0 L1 0 L1 1 Z" });
    expect(frameMask({ kind: "rect", radius: 0.3 }, { x: 0.5, y: 0.5, w: 1, h: 1 }, "m")).toMatchObject({ shape: "rectangle", roundness: 0.3, w: 1, h: 1 });
    expect(frameMask({ kind: "path", path: "M0 0 L1 0 L1 1 Z" }, { x: 0.5, y: 0.5, w: 1, h: 1 }, "m")).toMatchObject({ shape: "path", path: "M0 0 L1 0 L1 1 Z" });
  });

  it("fits a frame inside a clip box keeping its own proportion", () => {
    expect(containedBox(1, 16 / 9)).toEqual({ x: 0.5, y: 0.5, w: 9 / 16, h: 1 });
    expect(containedBox(1, 0.5)).toEqual({ x: 0.5, y: 0.5, w: 1, h: 0.5 });
  });
});

describe("frames in the image editor", () => {
  it("inserts every frame as layers that hold at least one empty slot a photo can fill", () => {
    for (const item of itemsOf(FRAMES_CATEGORY)) {
      const content = imageContent(item, request())!;
      const board = { ...emptyArtboard(SQUARE), layers: [] };
      const placed = insertImageContent(board, content).document;
      expect(surfaceIssue(placed), item.id).toBeNull();
      const slots = placed.layers.filter((layer) => fillTargetAt(placed, { x: layer.transform.x * 1000, y: layer.transform.y * 1000 })?.frameId === layer.id);
      expect(slots.length, item.id).toBeGreaterThan(0);
    }
  });

  it("keeps the item proportion on artboards of any shape", () => {
    const [slot] = imageContent(itemOf(FRAMES_CATEGORY, "frame-circle"), request({ width: 1600, height: 900 }))!.layers;
    expect(slot.transform.w * 1600).toBeCloseTo(slot.transform.h * 900);
  });
});

describe("frames in the video editor", () => {
  it("never become clips of their own", () => {
    expect(videoClips(itemOf(FRAMES_CATEGORY, "frame-circle"), { ...request(), atMs: 0, documentMs: 0 })).toBeNull();
    expect(videoClips(itemOf(GRIDS_CATEGORY, "grid-two-columns"), { ...request(), atMs: 0, documentMs: 0 })).toBeNull();
  });

  it("masks each chosen clip with the frame shape, round in pixels on a wide clip", () => {
    const { doc, ids } = film(1);
    const framed = frameWithItem(doc, itemOf(FRAMES_CATEGORY, "frame-circle"), ids)!;
    if (!framed.ok) throw new Error(framed.reason);
    const [mask] = framed.document.tracks[0].clips[0].masks!;
    expect(mask).toMatchObject({ shape: "ellipse", h: 1 });
    expect(mask.w).toBeCloseTo(9 / 16);
  });

  it("refuses without clips, on sound or text and on locked tracks", () => {
    const { doc, ids } = film(1);
    const frame = itemOf(FRAMES_CATEGORY, "frame-heart");
    expect(frameWithItem(doc, frame, [])).toEqual({ ok: false, reason: "noClips" });
    const text = { ...doc, tracks: [{ id: "t", kind: "visual" as const, clips: [{ ...newOverlayClip(newShapeLayer("rect"), 0, 1000), id: "text" }] }] };
    expect(frameWithItem(text, frame, ["text"])).toEqual({ ok: false, reason: "notMedia" });
    const locked = { ...doc, tracks: doc.tracks.map((track) => ({ ...track, locked: true })) };
    expect(frameWithItem(locked, frame, ids)).toEqual({ ok: false, reason: "locked" });
  });

  it("finds the picture under a point of the frame", () => {
    const { doc } = film(2);
    expect(mediaClipAt(doc, 500, 0.5, 0.5)).toBe("clip-1");
  });
});

describe("grids", () => {
  const twoByTwo = splitNode("column", [splitNode("row", [cellNode(), cellNode()]), splitNode("row", [cellNode(), cellNode()])]);

  it("splits the area into cells with an even gap and padding", () => {
    const cells = gridCells(twoByTwo, SQUARE);
    expect(cells).toHaveLength(4);
    expect(cellCount(twoByTwo)).toBe(4);
    const gap = 12;
    expect(cells[0].rect.left).toBeCloseTo(gap);
    expect(cells[1].rect.left - (cells[0].rect.left + cells[0].rect.width)).toBeCloseTo(gap);
    expect(cells[3].rect.top + cells[3].rect.height).toBeCloseTo(1000 - gap);
  });

  it("builds image cells on auto layout that the layout engine leaves where they are", () => {
    for (const item of itemsOf(GRIDS_CATEGORY)) {
      const content = gridLayers(item.template.kind === "grid" ? item.template.root : twoByTwo, { width: 1080, height: 1350 });
      const board = { ...emptyArtboard({ width: 1080, height: 1350 }), ...content };
      expect(layoutsIssue(board.groups ?? [], board.layers), item.id).toBeNull();
      expect(surfaceIssue(board), item.id).toBeNull();
      const laid = layoutSurface(board)!;
      laid.layers.forEach((layer, i) => {
        expect(layer.transform.x, item.id).toBeCloseTo(board.layers[i].transform.x, 6);
        expect(layer.transform.y, item.id).toBeCloseTo(board.layers[i].transform.y, 6);
        expect(layer.transform.w, item.id).toBeCloseTo(board.layers[i].transform.w, 6);
      });
    }
  });

  it("covers the whole artboard by default and a given box when asked", () => {
    const item = itemOf(GRIDS_CATEGORY, "grid-two-columns");
    const whole = imageContent(item, request(SQUARE, { name: "Grade" }))!;
    expect(whole.layers[0].transform).toMatchObject({ x: 0.5, y: 0.5, w: 1, h: 1 });
    expect(whole.groups![0].name).toBe("Grade");
    const boxed = imageContent(item, request(SQUARE, { box: { x: 0.3, y: 0.4, w: 0.4 } }))!;
    expect(boxed.layers[0].transform).toMatchObject({ x: 0.3, y: 0.4, w: 0.4, h: 0.4 });
  });

  it("places clips into the cells of a split screen, covering each cell", () => {
    const { doc, ids } = film(2);
    const framed = gridClips(doc, ids, splitNode("row", [cellNode({ kind: "rect", radius: 0.2 }), cellNode()]));
    if (!framed.ok) throw new Error(framed.reason);
    const [left, right] = framed.document.tracks.map((track) => track.clips[0]);
    expect(left.fit).toBe("cover");
    expect(left.transform.x).toBeLessThan(0.5);
    expect(right.transform.x).toBeGreaterThan(0.5);
    expect(left.masks).toHaveLength(1);
    expect(left.masks![0]).toMatchObject({ shape: "rectangle", roundness: 0.2, w: 1, h: 1 });
    expect(right.masks).toBeUndefined();
  });

  it("refuses more clips than cells", () => {
    const { doc, ids } = film(3);
    expect(gridClips(doc, ids, splitNode("row", [cellNode(), cellNode()]))).toEqual({ ok: false, reason: "tooMany", count: 2 });
  });
});
