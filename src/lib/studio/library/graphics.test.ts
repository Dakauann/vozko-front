import { describe, expect, it } from "vitest";

import { boxBounds, unionBounds } from "../arrange";
import { emptyArtboard, emptyVideoDocument, type Layer } from "../document";
import { documentIssue, surfaceIssue } from "../validate";
import { GRAPHICS_CATEGORY, GRAPHICS_SUBCATEGORIES } from "./builtin/graphics";
import { closedCurve, openCurve, sparkle, taperedStroke } from "./decor/geometry";
import { imageContent, insertImageContent, insertVideoClips, readyItem, videoClips, type LibraryRequest } from "./instantiate";
import { LIBRARY_INK, type LibraryItem } from "./model";
import { layerColors } from "./placement";
import { PREVIEW_INK } from "./preview";
import { loadItems } from "./store";

const SQUARE = { width: 1080, height: 1080 };
const CANVASES = [SQUARE, { width: 1080, height: 1920 }, { width: 2400, height: 1200 }];
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

function request(canvas = SQUARE, extra: Partial<LibraryRequest> = {}): LibraryRequest {
  return { canvas, locale: "pt", text: () => "", ...extra };
}

async function decorItems(): Promise<readonly LibraryItem[]> {
  const items = await loadItems(GRAPHICS_CATEGORY);
  const own = items.filter((item) => item.source.set === "vozko");
  for (const item of own) expect(await readyItem(item), item.id).toBe(true);
  return own;
}

function paths(layers: readonly Layer[]): string[] {
  return layers.map((layer) => layer.path ?? "");
}

describe("decor geometry", () => {
  it("draws closed and open curves through every point as cubic segments", () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const closed = closedCurve(square);
    expect(closed.startsWith("M0 0 C")).toBe(true);
    expect(closed.endsWith("Z")).toBe(true);
    expect(closed.match(/C/g)).toHaveLength(4);
    const open = openCurve(square);
    expect(open.match(/C/g)).toHaveLength(3);
    expect(open.endsWith("0 10")).toBe(true);
  });

  it("makes sparkles with four tips and tapered strokes that close", () => {
    expect(sparkle(50, 50, 40, 0.2).match(/Q/g)).toHaveLength(4);
    const stroke = taperedStroke([{ x: 0, y: 50 }, { x: 50, y: 40 }, { x: 100, y: 50 }], 10, 3, 0);
    expect(stroke.startsWith("M")).toBe(true);
    expect(stroke.endsWith("Z")).toBe(true);
  });
});

describe("decorative packs", () => {
  it("cover every pack with named items free of long dashes", async () => {
    const items = await decorItems();
    expect(items.length).toBeGreaterThanOrEqual(50);
    const subcategories = new Set(items.map((item) => item.subcategory));
    for (const id of ["blobs", "waves", "confetti", "sparkles", "doodles", "dotFrames", "brushes", "backgrounds"]) expect(subcategories.has(id), id).toBe(true);
    for (const item of items) {
      expect(GRAPHICS_SUBCATEGORIES, item.id).toContain(item.subcategory);
      expect(item.id, item.id).toMatch(/^graphic-/);
      expect(item.editors, item.id).toEqual(["image", "video"]);
      const words = "text" in item.label ? Object.values(item.label.text) : [];
      for (const word of words) expect(DASHES.test(word), `${item.id}: ${word}`).toBe(false);
    }
  });

  it("insert editable vector shapes the image editor accepts on any artboard", async () => {
    for (const item of await decorItems()) {
      for (const canvas of CANVASES) {
        const content = imageContent(item, request(canvas));
        expect(content, item.id).not.toBeNull();
        expect(content!.layers.every((layer) => layer.type === "shape" && layer.shape === "path"), item.id).toBe(true);
        const board = insertImageContent({ ...emptyArtboard(canvas), layers: [] }, content!).document;
        expect(surfaceIssue(board), `${item.id} on ${canvas.width}x${canvas.height}`).toBeNull();
      }
    }
  });

  it("insert as overlay clips the video editor accepts", async () => {
    const items = await decorItems();
    const doc = items.reduce((current, item, index) => {
      const clips = videoClips(item, { ...request(), atMs: index * 4000, documentMs: current.durationMs });
      expect(clips?.length, item.id).toBeGreaterThan(0);
      return insertVideoClips(current, clips!)!.document;
    }, emptyVideoDocument("square"));
    expect(documentIssue("video", doc)).toBeNull();
  });

  it("draw the same shapes every time", async () => {
    for (const item of await decorItems()) expect(paths(imageContent(item, request())!.layers), item.id).toEqual(paths(imageContent(item, request())!.layers));
  });

  it("paint single color items with the editor ink and keep the palette of colored ones", async () => {
    for (const item of await decorItems()) {
      const image = layerColors(imageContent(item, request())!.layers);
      const video = layerColors(videoClips(item, { ...request(), atMs: 0, documentMs: 0 })!.flatMap((clip) => (clip.layer ? [clip.layer] : [])));
      expect(video, item.id).toEqual(image.map((color) => (color === LIBRARY_INK.image ? LIBRARY_INK.video : color)));
    }
  });

  it("draw the ink parts of every preview in the preview ink and keep the palette of colored parts", async () => {
    for (const item of await decorItems()) {
      expect(item.preview.kind, item.id).toBe("deferred");
      if (item.preview.kind !== "deferred") continue;
      const preview = await item.preview.load();
      expect(preview.kind, item.id).toBe("svg");
      if (preview.kind !== "svg") continue;
      const colors = layerColors(imageContent(item, request())!.layers);
      const body = preview.markup.slice(preview.markup.indexOf(">") + 1);
      const painted = [...body.matchAll(/ (?:fill|stroke)="([^"]+)"/g)].map(([, color]) => color.toLowerCase()).filter((color) => color !== "none");
      expect(new Set(painted), item.id).toEqual(new Set(colors.map((color) => (color === LIBRARY_INK.image ? PREVIEW_INK.toLowerCase() : color))));
    }
  });

  it("frame the whole artboard with background items and keep its middle free", async () => {
    const backgrounds = (await decorItems()).filter((item) => item.subcategory === "backgrounds");
    expect(backgrounds.length).toBeGreaterThanOrEqual(6);
    for (const canvas of CANVASES) {
      for (const item of backgrounds) {
        const layers = imageContent(item, request(canvas))!.layers;
        const bounds = unionBounds(layers.map((layer) => boxBounds(layer.transform, canvas)));
        expect(bounds.left, item.id).toBeLessThanOrEqual(canvas.width * 0.02);
        expect(bounds.right, item.id).toBeGreaterThanOrEqual(canvas.width * 0.98);
        const middle = { x: canvas.width / 2, y: canvas.height / 2 };
        const covering = layers.filter((layer) => {
          const box = boxBounds(layer.transform, canvas);
          return box.left < middle.x - canvas.width * 0.2 && box.right > middle.x + canvas.width * 0.2 && box.top < middle.y - canvas.height * 0.2 && box.bottom > middle.y + canvas.height * 0.2;
        });
        expect(covering, `${item.id} on ${canvas.width}x${canvas.height}`).toEqual([]);
      }
    }
  });
});

describe("open illustrations", () => {
  it("bring the CC0 people and doodles as recolorable vector groups", async () => {
    const items = (await loadItems(GRAPHICS_CATEGORY)).filter((item) => item.source.set !== "vozko");
    const sets = new Set(items.map((item) => item.source.set));
    expect([...sets].sort()).toEqual(["humaaans", "open-doodles", "open-peeps"]);
    expect(items.filter((item) => item.subcategory === "people").length).toBeGreaterThanOrEqual(90);
    expect(items.filter((item) => item.subcategory === "illustrations").length).toBeGreaterThanOrEqual(30);
    for (const item of items) {
      expect(item.source.license, item.id).toBe("CC0-1.0");
      expect(item.source.credit, item.id).toBe("Pablo Stanley");
      expect(await readyItem(item), item.id).toBe(true);
      const content = imageContent(item, request())!;
      expect(content.layers.every((layer) => layer.type === "shape" && layer.shape === "path"), item.id).toBe(true);
      expect(surfaceIssue(insertImageContent({ ...emptyArtboard(SQUARE), layers: [] }, content).document), item.id).toBeNull();
      expect(item.palette?.("image").length, item.id).toBeGreaterThan(0);
    }
  }, 60_000);
});
