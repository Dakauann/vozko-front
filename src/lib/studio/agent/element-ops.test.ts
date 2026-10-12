import { describe, expect, it } from "vitest";

import { emptyVideoDocument, imageDocument, type ImageDocument, type VideoDocument } from "../document";
import { CONTROLS_CATEGORY } from "../library/builtin/controls";
import { iconsCategory } from "../library/builtin/icons";
import { SHAPES_CATEGORY } from "../library/builtin/shapes";
import { TEXT_CATEGORY, TEXT_STYLES_CATEGORY } from "../library/builtin/text";
import { readyItem } from "../library/instantiate";
import { LIBRARY_INK, type LibraryCategory } from "../library/model";
import { layerColors } from "../library/placement";
import { itemIndex, loadAllItems } from "../library/store";
import { findClip } from "../timeline";
import { planBatch } from "./batch";
import { iconPlan, type LibraryLookup } from "./element-ops";
import { applyImageOperation, IMAGE_ID_FIELDS, imageIds, type ImageOpContext, type ImageOperation } from "./image-ops";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

const CATEGORIES: LibraryCategory[] = [TEXT_CATEGORY, TEXT_STYLES_CATEGORY, SHAPES_CATEGORY, iconsCategory(["star"]), CONTROLS_CATEGORY];

const LIBRARY: LibraryLookup = {
  items: itemIndex(await loadAllItems(CATEGORIES)),
  text: (label) => ("key" in label ? `exemplo:${label.key.split(".").pop()}` : label.text.pt),
  locale: "pt-BR",
};

const IMAGE_CTX: ImageOpContext = { naturalSize: () => undefined, icons: ["star"], activeArtboard: "a1", library: LIBRARY };

const VIDEO_CTX: VideoOpContext = {
  playheadMs: 500,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => undefined,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: () => undefined,
  library: LIBRARY,
};

function artboard(): ImageDocument {
  return imageDocument([{ id: "a1", x: 0, y: 0, canvas: { width: 1000, height: 1000, background: "#ffffff" }, layers: [] }]);
}

function image(ops: ImageOperation[], ctx: ImageOpContext = IMAGE_CTX) {
  return planBatch(artboard(), ops, (doc, op) => applyImageOperation(doc, op, ctx), IMAGE_ID_FIELDS, imageIds);
}

function video(ops: VideoOperation[], start: VideoDocument = emptyVideoDocument("story"), ctx: VideoOpContext = VIDEO_CTX) {
  return planBatch(start, ops, (doc, op) => applyVideoOperation(doc, op, ctx), VIDEO_ID_FIELDS, videoIds);
}

describe("add_element in the image editor", () => {
  it("inserts the library item as ordinary layers, placed, worded and recolored", () => {
    const plan = image([{ op: "add_element", ref: "titulo", item_id: "text-heading", x: 0.5, y: 0.2, texts: [{ slot: "text", text: "Oferta" }], colors: [{ from: "#111111", to: "#ff0055" }] }]);
    if (!plan.ok) throw new Error(plan.reason);
    const layers = plan.final.artboards[0].layers;
    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({ type: "text", text: "Oferta", fill: "#ff0055" });
    expect(layers[0].transform).toMatchObject({ x: 0.5, y: 0.2 });
    expect(plan.created.titulo).toEqual([layers[0].id]);
  });

  it("falls back to the sample words and keeps the size of a form unless asked", () => {
    const plan = image([{ op: "add_element", item_id: "text-body" }, { op: "add_element", item_id: "shape-heart", w: 0.5 }]);
    if (!plan.ok) throw new Error(plan.reason);
    const [body, heart] = plan.final.artboards[0].layers;
    expect(body.text).toBe("exemplo:body");
    expect(heart.transform.w).toBeCloseTo(0.5);
    expect(heart.transform.h).toBeCloseTo(0.5);
  });

  it("refuses ids that are not in the library, with nearby suggestions", () => {
    const plan = image([{ op: "add_element", item_id: "shape-hart" }]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("shape-heart");
  });

  it("refuses video only items, unknown slots and broken colors", () => {
    for (const op of [
      { op: "add_element", item_id: "control-null" },
      { op: "add_element", item_id: "text-heading", texts: [{ slot: "title", text: "Oi" }] },
      { op: "add_element", item_id: "shape-heart", texts: [{ slot: "text", text: "Oi" }] },
      { op: "add_element", item_id: "shape-heart", colors: [{ from: "azul", to: "#000000" }] },
      { op: "add_element" },
    ] as ImageOperation[]) {
      expect(image([op]).ok, JSON.stringify(op)).toBe(false);
    }
  });

  it("fails closed when the editor has not loaded the library", () => {
    expect(image([{ op: "add_element", item_id: "shape-heart" }], { ...IMAGE_CTX, library: undefined }).ok).toBe(false);
  });

  it("notes colors the item does not have and style fields it ignores", () => {
    const plan = image([{ op: "add_element", item_id: "shape-heart", colors: [{ from: "#000000", to: "#ffffff" }], fill: "#00ff00" }]);
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.notes.join(" ")).toMatch(/#000000.*#3b82f6/);
    expect(plan.notes.join(" ")).toContain("estilo");
  });
});

describe("add_element in the video editor", () => {
  it("places a single overlay at the playhead, or at at_ms for duration_ms", () => {
    const plan = video([{ op: "add_element", ref: "star", item_id: "icon-star" }, { op: "add_element", ref: "arrow", item_id: "shape-arrow", at_ms: 2000, duration_ms: 1500 }]);
    if (!plan.ok) throw new Error(plan.reason);
    const [star, arrow] = [plan.created.star[0], plan.created.arrow[0]].map((id) => findClip(plan.final, id)!.clip);
    expect(star).toMatchObject({ type: "overlay", startMs: 500 });
    expect(star.layer).toMatchObject({ type: "icon", iconId: "star", fill: "#ffffff" });
    expect(arrow).toMatchObject({ startMs: 2000, durationMs: 1500 });
  });

  it("inserts multi part styles as linked clips and lists every created id", () => {
    const plan = video([{ op: "add_element", ref: "faixa", item_id: "text-style-lower-third", texts: [{ slot: "text", text: "Ana Lima" }] }]);
    if (!plan.ok) throw new Error(plan.reason);
    const created = plan.created.faixa;
    expect(created).toHaveLength(2);
    const clips = created.map((id) => findClip(plan.final, id)!.clip);
    expect(clips[0].linkId).toBeDefined();
    expect(clips[0].linkId).toBe(clips[1].linkId);
    expect(clips.some((clip) => clip.layer?.text === "Ana Lima")).toBe(true);
  });

  it("adds a null from the library like the panel does", () => {
    const plan = video([{ op: "add_element", ref: "rig", item_id: "control-null", at_ms: 1000 }]);
    if (!plan.ok) throw new Error(plan.reason);
    expect(findClip(plan.final, plan.created.rig[0])!.clip).toMatchObject({ type: "null", startMs: 1000, durationMs: 3000 });
  });

  it("refuses a missing track for a multi part item", () => {
    expect(video([{ op: "add_element", item_id: "text-style-cta", track_id: "ghost" }]).ok).toBe(false);
  });
});

describe("add_icon takes catalog ids and library icon ids through one resolution", () => {
  it("draws a library icon item in the image editor, colored by fill", async () => {
    expect(await readyItem(LIBRARY.items.get("icon-truck-regular")!)).toBe(true);
    const plan = image([{ op: "add_icon", ref: "caminhao", icon_id: "icon-truck-regular", x: 0.3, y: 0.4, w: 0.2, fill: "#ff0055" }]);
    if (!plan.ok) throw new Error(plan.reason);
    const layers = plan.final.artboards[0].layers;
    expect(plan.created.caminhao.length).toBeGreaterThan(0);
    expect(plan.created.caminhao.every((id) => layers.some((layer) => layer.id === id))).toBe(true);
    expect(layerColors(layers)).toContain("#ff0055");
    expect(layerColors(layers)).not.toContain(LIBRARY_INK.image);
  });

  it("uses the catalog icon behind an own library item, keeping every style field", () => {
    const plan = image([{ op: "add_icon", ref: "estrela", icon_id: "icon-star", fill: "#00aa55", shadow: { blur: 20, y: 6 } }]);
    if (!plan.ok) throw new Error(plan.reason);
    const [layer] = plan.final.artboards[0].layers;
    expect(layer).toMatchObject({ type: "icon", iconId: "star", fill: "#00aa55" });
    expect(layer.shadow).toBeDefined();
  });

  it("keeps catalog ids on the catalog path, even without the library", () => {
    const plan = image([{ op: "add_icon", icon_id: "star", fill: "#123456" }], { ...IMAGE_CTX, library: undefined });
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.final.artboards[0].layers[0]).toMatchObject({ type: "icon", iconId: "star", fill: "#123456" });
  });

  it("sends a library item that is not an icon to add_element with its exact id", () => {
    const plan = image([{ op: "add_icon", icon_id: "shape-heart" }]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain('add_element com item_id "shape-heart"');
  });

  it("refuses unknown ids with catalog and library suggestions, and a broken fill", () => {
    const unknown = image([{ op: "add_icon", icon_id: "icon-truk-regular" }]);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toContain("icon-truck-regular");
    const blank = image([{ op: "add_icon", icon_id: "  " }]);
    expect(blank.ok).toBe(false);
    const fill = image([{ op: "add_icon", icon_id: "icon-truck-regular", fill: "vermelho" }]);
    expect(fill.ok).toBe(false);
    if (!fill.ok) expect(fill.reason).toContain("fill");
  });

  it("fails closed on a library icon id when the editor has not loaded the library", () => {
    const plan = image([{ op: "add_icon", icon_id: "icon-truck-regular" }], { ...IMAGE_CTX, library: undefined });
    expect(plan.ok).toBe(false);
  });

  it("places a library icon in the video editor at at_ms", async () => {
    await readyItem(LIBRARY.items.get("icon-truck-regular")!);
    const plan = video([{ op: "add_icon", ref: "caminhao", icon_id: "icon-truck-regular", at_ms: 1200, duration_ms: 2000, fill: "#ffcc00" }]);
    if (!plan.ok) throw new Error(plan.reason);
    const clips = plan.created.caminhao.map((id) => findClip(plan.final, id)!.clip);
    expect(clips.length).toBeGreaterThan(0);
    expect(clips[0]).toMatchObject({ startMs: 1200, durationMs: 2000 });
    expect(layerColors(clips.flatMap((clip) => (clip.layer ? [clip.layer] : [])))).toContain("#ffcc00");
  });
});

describe("iconPlan", () => {
  it("resolves catalog ids first, then own library items to their catalog icon, then library icons", () => {
    expect(iconPlan("star", ["star"], "image", undefined)).toEqual({ ok: true, kind: "catalog", iconId: "star" });
    expect(iconPlan("icon-star", ["star"], "image", LIBRARY)).toEqual({ ok: true, kind: "catalog", iconId: "star" });
    expect(iconPlan("icon-truck-regular", ["star"], "video", LIBRARY, "#ffcc00")).toEqual({ ok: true, kind: "library", element: { item_id: "icon-truck-regular", colors: [{ from: LIBRARY_INK.video, to: "#ffcc00" }] } });
  });
});
