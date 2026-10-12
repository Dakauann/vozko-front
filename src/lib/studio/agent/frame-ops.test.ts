import { describe, expect, it } from "vitest";

import { emptyVideoDocument, imageDocument, newMediaClip, type ImageDocument, type VideoDocument } from "../document";
import { FRAMES_CATEGORY } from "../library/builtin/frames";
import { GRIDS_CATEGORY } from "../library/builtin/grids";
import { STICKERS_CATEGORY } from "../library/builtin/stickers";
import type { LibraryItem } from "../library/model";
import { itemIndex } from "../library/store";
import { planBatch } from "./batch";
import type { LibraryLookup } from "./element-ops";
import { applyImageOperation, IMAGE_ID_FIELDS, imageIds, type ImageOpContext, type ImageOperation } from "./image-ops";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

const LIBRARY: LibraryLookup = {
  items: itemIndex([FRAMES_CATEGORY, GRIDS_CATEGORY, STICKERS_CATEGORY].flatMap((category) => category.items() as readonly LibraryItem[])),
  text: (label) => ("key" in label ? label.key : label.text.pt),
  locale: "pt-BR",
};

const PHOTOS: Record<string, { width: number; height: number }> = { wide: { width: 2000, height: 1000 }, square: { width: 800, height: 800 } };

const IMAGE_CTX: ImageOpContext = { naturalSize: (id) => PHOTOS[id], icons: [], activeArtboard: "a1", library: LIBRARY };

const VIDEO_CTX: VideoOpContext = {
  playheadMs: 0,
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

function image(ops: ImageOperation[], start: ImageDocument = artboard()) {
  return planBatch(start, ops, (doc, op) => applyImageOperation(doc, op, IMAGE_CTX), IMAGE_ID_FIELDS, imageIds);
}

function film(count: number): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  return { ...doc, durationMs: 3000, tracks: Array.from({ length: count }, (_, i) => ({ id: `t${i}`, kind: "visual" as const, clips: [{ ...newMediaClip("video", `v${i}`, 0, 3000), id: `c${i}` }] })) };
}

function video(ops: VideoOperation[], start: VideoDocument) {
  return planBatch(start, ops, (doc, op) => applyVideoOperation(doc, op, VIDEO_CTX), VIDEO_ID_FIELDS, videoIds);
}

describe("frames for Elo in the image editor", () => {
  it("inserts a frame, names its empty slot and fills it with a library photo", () => {
    const plan = image([
      { op: "add_element", ref: "moldura", item_id: "frame-circle" },
      { op: "fill_frame", ref: "foto", layer_id: "@moldura", media_id: "wide" },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    const [frame, photo] = plan.final.artboards[0].layers;
    expect(plan.notes.some((note) => note.includes(frame.id) && note.includes("fill_frame"))).toBe(true);
    expect(photo).toMatchObject({ type: "image", assetId: "wide", clip: true, transform: frame.transform, crop: { x: 0.25, y: 0, w: 0.5, h: 1 } });
    expect(plan.created.foto).toEqual([photo.id]);
  });

  it("fills a grid cell and swaps the photo of a filled frame without moving it", () => {
    const plan = image([{ op: "add_element", item_id: "grid-two-columns" }]);
    if (!plan.ok) throw new Error(plan.reason);
    const cell = plan.final.artboards[0].layers.find((layer) => layer.pattern)!;
    const filled = image([{ op: "fill_frame", layer_id: cell.id, media_id: "square" }], plan.final);
    if (!filled.ok) throw new Error(filled.reason);
    const photo = filled.final.artboards[0].layers.find((layer) => layer.type === "image")!;
    expect(photo.groupId).toBe(cell.groupId);
    const swapped = image([{ op: "fill_frame", layer_id: photo.id, media_id: "wide" }], filled.final);
    if (!swapped.ok) throw new Error(swapped.reason);
    const after = swapped.final.artboards[0].layers.find((layer) => layer.id === photo.id)!;
    expect(after).toMatchObject({ assetId: "wide", transform: photo.transform });
    expect(swapped.final.artboards[0].layers.filter((layer) => layer.type === "image")).toHaveLength(1);
  });

  it("refuses a layer that is not a frame and a photo that is not in the library", () => {
    const text = image([{ op: "add_text", ref: "t", text: "Oi" }, { op: "fill_frame", layer_id: "@t", media_id: "wide" }]);
    expect(text.ok).toBe(false);
    if (!text.ok) expect(text.reason).toContain("moldura");
    const missing = image([{ op: "add_element", ref: "m", item_id: "frame-heart" }, { op: "fill_frame", layer_id: "@m", media_id: "nope" }]);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toContain("biblioteca");
  });

  it("pans a framed photo with crop without moving it off the frame", () => {
    const plan = image([
      { op: "add_element", ref: "m", item_id: "frame-square" },
      { op: "fill_frame", ref: "f", layer_id: "@m", media_id: "wide" },
      { op: "update_layer", layer_id: "@f", crop: { x: 0, y: 0, w: 0.5, h: 1 } },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    const [frame, photo] = plan.final.artboards[0].layers;
    expect(photo.transform).toEqual(frame.transform);
    expect(photo.crop).toMatchObject({ x: 0, y: 0, w: 0.5, h: 1 });
  });

  it("inserts a sticker's final frame", () => {
    const plan = image([{ op: "add_element", item_id: "sticker-word-thanks", texts: [{ slot: "text", text: "VALEU" }] }]);
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.final.artboards[0].layers[0]).toMatchObject({ type: "text", text: "VALEU" });
  });
});

describe("frames and grids for Elo in the video editor", () => {
  it("masks the chosen clips with a frame", () => {
    const plan = video([{ op: "add_element", item_id: "frame-heart", clip_ids: ["c0"] }], film(1));
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.final.tracks[0].clips[0].masks?.[0]).toMatchObject({ shape: "path" });
    expect(plan.changed).toEqual(["c0"]);
  });

  it("splits the screen between clips in order and refuses without clips or with too many", () => {
    const plan = video([{ op: "add_element", item_id: "grid-two-columns", clip_ids: ["c1", "c0"] }], film(2));
    if (!plan.ok) throw new Error(plan.reason);
    const [c0, c1] = plan.final.tracks.map((track) => track.clips[0]);
    expect(c1.transform.x).toBeLessThan(c0.transform.x);
    const none = video([{ op: "add_element", item_id: "grid-two-columns" }], film(2));
    expect(none.ok).toBe(false);
    const many = video([{ op: "add_element", item_id: "grid-two-columns", clip_ids: ["c0", "c1", "c2"] }], film(3));
    expect(many.ok).toBe(false);
    if (!many.ok) expect(many.reason).toContain("2");
  });

  it("stretches a sticker's animation to the asked length", () => {
    const plan = video([{ op: "add_element", item_id: "sticker-arrow", duration_ms: 5000 }], emptyVideoDocument("square"));
    if (!plan.ok) throw new Error(plan.reason);
    const clip = plan.final.tracks.flatMap((track) => track.clips)[0];
    expect(clip.durationMs).toBe(5000);
    expect(clip.keyframes?.trimEnd?.at(-1)?.value).toBe(1);
  });
});
