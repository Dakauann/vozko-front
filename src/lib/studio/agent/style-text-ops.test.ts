import { describe, expect, it } from "vitest";

import { emptyArtboard, emptyVideoDocument, IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, type ImageDocument, type VideoDocument } from "../document";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { applyImageOperation, IMAGE_ID_FIELDS, IMAGE_OPERATIONS, type ImageOpContext, type ImageOperation } from "./image-ops";
import { imageOutline, outlineClip } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, VIDEO_OPERATIONS, type VideoOpContext, type VideoOperation } from "./video-ops";

const outlineCtx = { detail: "full" as const, asset: () => undefined, icons: [], playheadMs: 0, selection: [], jobs: [], activeArtboard: "main" };

const imageCtx: ImageOpContext = { naturalSize: () => undefined, icons: [], activeArtboard: "main", keyColor: () => undefined };

const videoCtx: VideoOpContext = {
  playheadMs: 0,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => undefined,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: () => undefined,
};

function image(): ImageDocument {
  return { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards: [{ ...emptyArtboard({ width: 1080, height: 1080 }), id: "main", layers: [] }] };
}

function video(): VideoDocument {
  const doc = emptyVideoDocument("story");
  doc.tracks = [{ id: "v1", kind: "visual", clips: [] }];
  return doc;
}

describe("style_text in the image editor", () => {
  it("styles a word by matching text and lists it in the outline", () => {
    const plan = planBatch(
      image(),
      [{ op: "add_text", ref: "t", text: "Compre agora" }, { op: "style_text", layer_id: "@t", match: "agora", fill: "#ffcc00", font_weight: 800 }, { op: "style_text", layer_id: "@t", char_start: 0, char_end: 6, caps: true }] as ImageOperation[],
      (d, op) => applyImageOperation(d, op, imageCtx),
      IMAGE_ID_FIELDS,
    );
    if (!plan.ok) throw new Error(plan.reason);
    expect(documentIssue("image", plan.final)).toBeNull();
    const layer = plan.final.artboards[0].layers[0];
    expect(layer.runs).toEqual([
      { start: 0, end: 6, caps: true },
      { start: 7, end: 12, fill: "#ffcc00", fontWeight: 800 },
    ]);
    const outlined = imageOutline(plan.final, outlineCtx).artboards?.[0].layers?.[0] as unknown as { runs: unknown };
    expect(outlined.runs).toEqual([
      { start: 0, end: 6, text: "Compre", caps: true },
      { start: 7, end: 12, text: "agora", fill: "#ffcc00", font_weight: 800 },
    ]);
    expect(IMAGE_OPERATIONS).toContain("style_text");
  });

  it("refuses a layer that is not text", () => {
    const plan = planBatch(image(), [{ op: "add_shape", ref: "s", shape: "rect" }, { op: "style_text", layer_id: "@s", caps: true }] as ImageOperation[], (d, op) => applyImageOperation(d, op, imageCtx), IMAGE_ID_FIELDS);
    expect(plan.ok).toBe(false);
  });
});

describe("style_text in the video editor", () => {
  it("styles part of a text clip and keeps the document valid", () => {
    const plan = planBatch(
      video(),
      [{ op: "add_text", ref: "t", text: "Frete grátis", track_id: "v1", at_ms: 0 }, { op: "style_text", clip_id: "@t", match: "grátis", underline: true, letter_spacing: 0.1 }] as VideoOperation[],
      (d, op) => applyVideoOperation(d, op, videoCtx),
      VIDEO_ID_FIELDS,
    );
    if (!plan.ok) throw new Error(plan.reason);
    expect(documentIssue("video", plan.final)).toBeNull();
    const clipId = plan.created.t[0];
    const clip = findClip(plan.final, clipId)!.clip;
    expect(clip.layer?.runs).toEqual([{ start: 6, end: 12, underline: true, letterSpacing: 0.1 }]);
    expect((outlineClip(clip, outlineCtx) as unknown as { runs: unknown }).runs).toEqual([{ start: 6, end: 12, text: "grátis", underline: true, letter_spacing: 0.1 }]);
    expect(VIDEO_OPERATIONS).toContain("style_text");
  });

  it("counts a counter as prefix, one number and suffix", () => {
    const plan = planBatch(
      video(),
      [
        { op: "add_text", ref: "t", text: "0", track_id: "v1", at_ms: 0 },
        { op: "set_counter", clip_id: "@t", counter_value: 1500, prefix: "R$ " },
        { op: "style_text", clip_id: "@t", match: "R$", fill: "#ffcc00" },
        { op: "style_text", clip_id: "@t", char_start: 3, char_end: 4, font_weight: 900 },
      ] as VideoOperation[],
      (d, op) => applyVideoOperation(d, op, videoCtx),
      VIDEO_ID_FIELDS,
    );
    if (!plan.ok) throw new Error(plan.reason);
    expect(documentIssue("video", plan.final)).toBeNull();
    expect(findClip(plan.final, plan.created.t[0])!.clip.layer?.runs).toEqual([
      { start: 0, end: 2, fill: "#ffcc00" },
      { start: 3, end: 4, fontWeight: 900 },
    ]);
  });
});
