import { describe, expect, it } from "vitest";

import { imageOutline } from "../agent/outline";
import { emptyArtboard, emptyVideoDocument, imageDocument, newShapeLayer, newTextLayer, VIDEO_ASPECT_SIZES, type CanvasSize } from "../document";
import { CONTROLS_CATEGORY } from "./builtin/controls";
import { iconsCategory } from "./builtin/icons";
import { SHAPES_CATEGORY } from "./builtin/shapes";
import { TEXT_CATEGORY, TEXT_STYLES_CATEGORY } from "./builtin/text";
import { imageContent, insertImageContent, insertVideoClips, videoClips, type LibraryRequest } from "./instantiate";
import { LIBRARY_INK, OWN_SOURCE, type LibraryCategory, type LibraryItem, type LibrarySlot } from "./model";
import { layerColors, placeLayers, recolorLayer } from "./placement";

const SQUARE: CanvasSize = { width: 1000, height: 1000 };
const STORY = VIDEO_ASPECT_SIZES.story;

function itemOf(category: LibraryCategory, id: string): LibraryItem {
  const found = (category.items() as readonly LibraryItem[]).find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function request(canvas: CanvasSize, extra: Partial<LibraryRequest> = {}): LibraryRequest {
  return { canvas, locale: "pt-BR", text: (slot: LibrarySlot) => `sample:${slot.id}`, ...extra };
}

describe("library items in the image editor", () => {
  it("draws marks in the image ink and keeps square shapes square on any artboard", async () => {
    const icons = await iconsCategory(["star"]).items();
    const icon = imageContent(icons.find((item) => item.id === "icon-star")!, request({ width: 1600, height: 900 }))!;
    expect(icon.layers[0]).toMatchObject({ type: "icon", iconId: "star", fill: LIBRARY_INK.image });
    expect(icon.layers[0].transform.w * 1600).toBeCloseTo(icon.layers[0].transform.h * 900);
    const line = imageContent(itemOf(SHAPES_CATEGORY, "shape-double-arrow"), request(SQUARE))!.layers[0];
    expect(line).toMatchObject({ shape: "arrow", arrowStart: true, arrowEnd: true, stroke: LIBRARY_INK.image });
  });

  it("fills text slots with the given words", () => {
    const heading = imageContent(itemOf(TEXT_CATEGORY, "text-heading"), request(SQUARE))!.layers[0];
    expect(heading).toMatchObject({ type: "text", text: "sample:text", fontWeight: 700, fill: LIBRARY_INK.image });
  });

  it("refuses items that only exist as video clips", () => {
    expect(imageContent(itemOf(TEXT_STYLES_CATEGORY, "text-style-cta"), request(SQUARE))).toBeNull();
    expect(imageContent(itemOf(CONTROLS_CATEGORY, "control-null"), request(SQUARE))).toBeNull();
  });

  it("groups a multi part item under its name, so the layers panel and the outline show it", () => {
    const slot: LibrarySlot = { id: "text", sample: { key: "sample" } };
    const combo: LibraryItem = {
      id: "combo-sale",
      category: "text",
      editors: ["image"],
      ratio: 2,
      label: { key: "combo" },
      preview: { kind: "text", size: 12, weight: 700 },
      source: OWN_SOURCE,
      template: { kind: "layers", slots: [slot], build: (ctx) => ({ layers: [newShapeLayer("rect"), newTextLayer(ctx.text(slot), "heading")] }) },
    };
    const content = imageContent(combo, request(SQUARE, { name: "Promoção" }))!;
    expect(content.groups).toEqual([{ id: content.layers[0].groupId, name: "Promoção" }]);
    expect(content.layers[1].groupId).toBe(content.layers[0].groupId);
    const board = emptyArtboard(SQUARE);
    const placed = insertImageContent(board, content);
    const outline = imageOutline(imageDocument([{ ...board, ...placed.document }]), { detail: "summary", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] });
    expect(outline.artboards[0].groups).toEqual([expect.objectContaining({ name: "Promoção" })]);
    expect(outline.artboards[0].layers.map((layer) => layer.group)).toEqual([outline.artboards[0].groups[0].id, outline.artboards[0].groups[0].id]);
  });

  it("pastes with fresh ids through the paste path", () => {
    const board = emptyArtboard(SQUARE);
    const content = imageContent(itemOf(SHAPES_CATEGORY, "shape-heart"), request(SQUARE))!;
    const first = insertImageContent(board, content);
    const second = insertImageContent(first.document, content);
    expect(second.document.layers).toHaveLength(2);
    expect(new Set(second.document.layers.map((l) => l.id)).size).toBe(2);
    expect(first.ids).toEqual([first.document.layers[0].id]);
  });
});

describe("library items in the video editor", () => {
  it("turns layers into overlays at the playhead in the overlay ink", () => {
    const [clip] = videoClips(itemOf(SHAPES_CATEGORY, "shape-squiggle"), { ...request(STORY), atMs: 1200, documentMs: 0 })!;
    expect(clip).toMatchObject({ type: "overlay", startMs: 1200 });
    expect(clip.layer).toMatchObject({ shape: "path", stroke: LIBRARY_INK.video });
  });

  it("builds linked clips for multi part text styles and stacks them above the picture", () => {
    const clips = videoClips(itemOf(TEXT_STYLES_CATEGORY, "text-style-cta"), { ...request(STORY), atMs: 0, documentMs: 0 })!;
    expect(clips).toHaveLength(2);
    expect(new Set(clips.map((c) => c.linkId)).size).toBe(1);
    expect(clips[1].layer?.text).toBe("sample:text");
    const doc = emptyVideoDocument("story");
    const placed = insertVideoClips(doc, clips)!;
    expect(placed.ids).toHaveLength(2);
  });

  it("gives a null the rest of the video, at least the default length", () => {
    const [null1] = videoClips(itemOf(CONTROLS_CATEGORY, "control-null"), { ...request(STORY), atMs: 1000, documentMs: 9000 })!;
    expect(null1).toMatchObject({ type: "null", startMs: 1000, durationMs: 8000 });
    const [null2] = videoClips(itemOf(CONTROLS_CATEGORY, "control-null"), { ...request(STORY), atMs: 0, documentMs: 0 })!;
    expect(null2.durationMs).toBe(3000);
  });

  it("formats the counter in the person's locale", () => {
    const [counter] = videoClips(itemOf(TEXT_CATEGORY, "text-counter"), { ...request(STORY, { locale: "en" }), atMs: 0, documentMs: 0 })!;
    expect(counter.counter?.locale).toBe("en-US");
  });
});

describe("placing library content", () => {
  it("moves the content center to the drop point and leaves size alone", () => {
    const layer = { ...newShapeLayer("rect"), transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.1, rotation: 0, opacity: 1 } };
    const [moved] = placeLayers([layer], SQUARE, { x: 0.2, y: 0.8 });
    expect(moved.transform).toMatchObject({ x: 0.2, y: 0.8, w: 0.2, h: 0.1 });
  });

  it("stretches a single part to both sides, and keeps several parts in proportion", () => {
    const layer = { ...newShapeLayer("rect"), transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.1, rotation: 0, opacity: 1 } };
    expect(placeLayers([layer], SQUARE, { w: 0.4, h: 0.4 })[0].transform).toMatchObject({ w: 0.4, h: 0.4 });
    const text = { ...newTextLayer("Oi", "heading"), transform: { x: 0.5, y: 0.6, w: 0.2, h: 0.1, rotation: 0, opacity: 1 }, strokeWidth: 4 };
    const [plate, label] = placeLayers([layer, text], SQUARE, { x: 0.5, y: 0.5, w: 0.4, h: 1 });
    expect(plate.transform.w).toBeCloseTo(0.4);
    expect(plate.transform.h).toBeCloseTo(0.2);
    expect(label.fontSize).toBeCloseTo(0.16);
    expect(label.strokeWidth).toBeCloseTo(8);
    expect(label.transform.y - plate.transform.y).toBeCloseTo(0.2);
  });

  it("swaps matching colors only", () => {
    const layer = { ...newShapeLayer("rect"), fill: "#3B82F6", stroke: "#111111", gradient: { from: "#3b82f6", to: "#ffffff", angle: 0 } };
    const swapped = recolorLayer(layer, [{ from: "#3b82f6", to: "#ff0055" }]);
    expect(swapped).toMatchObject({ fill: "#ff0055", stroke: "#111111", gradient: { from: "#ff0055", to: "#ffffff" } });
    expect(layerColors([layer])).toEqual(["#3b82f6", "#111111", "#ffffff"]);
  });
});
