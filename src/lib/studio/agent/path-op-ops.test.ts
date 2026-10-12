import { describe, expect, it } from "vitest";

import { emptyArtboard, emptyVideoDocument, IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, newOverlayClip, newShapeLayer, newTextLayer, type ImageDocument, type VideoDocument } from "../document";
import { MERGE_OPERAND_PATHS, type MergeOp, type OffsetOp } from "../path-ops";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { applyImageOperation, IMAGE_ID_FIELDS, type ImageOpContext, type ImageOperation } from "./image-ops";
import { imageOutline, outlineClip, type OutlineContext } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, type VideoOpContext, type VideoOperation } from "./video-ops";

function film(): VideoDocument {
  const doc = emptyVideoDocument("square");
  const badge = { ...newShapeLayer("star", { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 }), id: "l-badge", fill: "#ffcc00" };
  const word = { ...newTextLayer("Oi"), id: "l-word" };
  doc.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newOverlayClip(badge, 0, 2000), id: "badge" }, { ...newOverlayClip(word, 2000, 1000), id: "word" }] }];
  doc.durationMs = 3000;
  return doc;
}

function board(): ImageDocument {
  return {
    schema: IMAGE_SCHEMA,
    version: IMAGE_DOCUMENT_VERSION,
    artboards: [
      {
        ...emptyArtboard({ width: 1000, height: 1000 }),
        id: "main",
        layers: [
          { ...newShapeLayer("rect", { x: 0.5, y: 0.5, w: 0.4, h: 0.4, rotation: 0, opacity: 1 }), id: "card", fill: "#ff0000" },
          { ...newShapeLayer("ellipse", { x: 0.7, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 }), id: "dot", fill: "#00ff00" },
          { ...newShapeLayer("line"), id: "rule", stroke: "#000000", strokeWidth: 4 },
        ],
      },
    ],
  };
}

const videoCtx: VideoOpContext = {
  playheadMs: 0,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => 10_000,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: () => undefined,
};

const imageCtx: ImageOpContext = { naturalSize: () => undefined, icons: [], activeArtboard: "main" };

const outlineCtx: OutlineContext = { detail: "full", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] };

function video(ops: VideoOperation[], base: VideoDocument = film()) {
  return planBatch(base, ops, (d, op) => applyVideoOperation(d, op, videoCtx), VIDEO_ID_FIELDS);
}

function image(ops: ImageOperation[], base: ImageDocument = board()) {
  return planBatch(base, ops, (d, op) => applyImageOperation(d, op, imageCtx), IMAGE_ID_FIELDS);
}

function videoDone(ops: VideoOperation[]): VideoDocument {
  const plan = video(ops);
  if (!plan.ok) throw new Error(plan.reason);
  expect(documentIssue("video", plan.final)).toBeNull();
  return plan.final;
}

function badgeOps(doc: VideoDocument) {
  return findClip(doc, "badge")!.clip.layer!.pathOps ?? [];
}

describe("path operators for Elo in video", () => {
  it("sets the whole stack in order, with defaults for what is not sent", () => {
    const doc = videoDone([{ op: "set_path_ops", clip_id: "badge", path_ops: [{ kind: "roundCorners", radius: 10 }, { kind: "zigZag", size: 6, ridges: 3, points: "smooth" }, { kind: "merge", mode: "subtract", operand: "ellipse", w: 0.3, h: 0.3 }] }]);
    const ops = badgeOps(doc);
    expect(ops.map((op) => op.kind)).toEqual(["roundCorners", "zigZag", "merge"]);
    expect((ops[2] as MergeOp).path).toBe(MERGE_OPERAND_PATHS.ellipse);
    expect((ops[2] as MergeOp).x).toBe(0.5);
  });

  it("keeps an existing operator by id, records keys with at_ms and animates with keys", () => {
    const first = videoDone([{ op: "set_path_ops", clip_id: "badge", path_ops: [{ kind: "offset", amount: 4 }] }]);
    const id = badgeOps(first)[0].id;
    const plan = video(
      [
        { op: "animate_path_op", clip_id: "badge", path_op_id: id, path_op_property: "amount", keys: [{ at_ms: 0, value: 0 }, { at_ms: 800, value: 20, easing: "backOut" }] },
        { op: "set_path_ops", clip_id: "badge", path_ops: [{ id, kind: "offset", amount: 30 }], at_ms: 400 },
      ],
      first,
    );
    if (!plan.ok) throw new Error(plan.reason);
    const offset = badgeOps(plan.final)[0] as OffsetOp;
    expect(offset.keyframes?.amount?.map((frame) => frame.atMs)).toEqual([0, 400, 800]);
    expect(offset.keyframes?.amount?.[1].value).toBe(30);
  });

  it("refuses with a reason the model can act on", () => {
    const refused = (ops: VideoOperation[]) => {
      const plan = video(ops);
      if (plan.ok) throw new Error("expected a refusal");
      return plan.reason;
    };
    expect(refused([{ op: "set_path_ops", clip_id: "word", path_ops: [{ kind: "twist" }] }])).toContain("não aceita operadores");
    expect(refused([{ op: "set_path_ops", clip_id: "badge", path_ops: [{ kind: "spiral" }] }])).toContain("kind");
    expect(refused([{ op: "set_path_ops", clip_id: "badge", path_ops: [{ kind: "twist", radius: 4 }] }])).toContain("radius");
    expect(refused([{ op: "set_path_ops", clip_id: "badge", path_ops: [{ kind: "offset", join: "round", points: "smooth" }] }])).toContain("points");
    expect(refused([{ op: "set_path_ops", clip_id: "badge", path_ops: [{ kind: "zigZag", ridges: 2.5 }] }])).toContain("inteiro");
    expect(refused([{ op: "set_path_ops", clip_id: "badge", path_ops: [{ kind: "merge", operand: "rect", path: "M0 0 L1 1 Z" }] }])).toContain("operand ou path");
    expect(refused([{ op: "set_path_ops", clip_id: "badge", path_ops: [{ id: "op-missing", kind: "offset" }] }])).toContain("não existe");
    expect(refused([{ op: "animate_path_op", clip_id: "badge", path_op_id: "op-missing", path_op_property: "amount", keys: [] }])).toContain("não existe");
  });

  it("asks for at_ms before changing an animated value", () => {
    const first = videoDone([{ op: "set_path_ops", clip_id: "badge", path_ops: [{ kind: "twist", angle: 0 }] }]);
    const id = badgeOps(first)[0].id;
    const plan = video([{ op: "animate_path_op", clip_id: "badge", path_op_id: id, path_op_property: "angle", keys: [{ at_ms: 0, value: 0 }, { at_ms: 900, value: 90 }] }, { op: "set_path_ops", clip_id: "badge", path_ops: [{ id, kind: "twist", angle: 45 }] }], first);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("at_ms");
  });

  it("shows the stack and its keys in the outline", () => {
    const first = videoDone([{ op: "set_path_ops", clip_id: "badge", path_ops: [{ kind: "puckerBloat", amount: -20 }] }]);
    const id = badgeOps(first)[0].id;
    const plan = video([{ op: "animate_path_op", clip_id: "badge", path_op_id: id, path_op_property: "amount", keys: [{ at_ms: 0, value: -20 }, { at_ms: 500, value: 30 }] }], first);
    if (!plan.ok) throw new Error(plan.reason);
    const outlined = outlineClip(findClip(plan.final, "badge")!.clip, outlineCtx);
    expect(outlined.path_ops?.[0]).toMatchObject({ id, kind: "puckerBloat", amount: -20, animated: ["amount"] });
  });
});

describe("path operators for Elo in the image editor", () => {
  it("sets a stack on several shapes and refuses lines", () => {
    const plan = image([{ op: "set_path_ops", layer_ids: ["card", "dot"], path_ops: [{ kind: "offset", amount: -10, join: "miter" }] }]);
    if (!plan.ok) throw new Error(plan.reason);
    expect(documentIssue("image", plan.final)).toBeNull();
    const card = plan.final.artboards[0].layers.find((layer) => layer.id === "card")!;
    expect(card.pathOps?.[0]).toMatchObject({ kind: "offset", amount: -10, join: "miter" });
    const refused = image([{ op: "set_path_ops", layer_id: "rule", path_ops: [{ kind: "twist" }] }]);
    expect(refused.ok).toBe(false);
    const outline = imageOutline(plan.final, { ...outlineCtx, activeArtboard: "main" });
    expect(outline.artboards[0].layers[0].path_ops?.[0]).toMatchObject({ kind: "offset" });
  });

  it("merges live: the upper shape becomes an operator of the lower one", () => {
    const plan = image([{ op: "combine_shapes", layer_ids: ["card", "dot"], mode: "subtract", live: true }]);
    if (!plan.ok) throw new Error(plan.reason);
    expect(documentIssue("image", plan.final)).toBeNull();
    const layers = plan.final.artboards[0].layers;
    expect(layers.map((layer) => layer.id)).toEqual(["card", "rule"]);
    const merge = layers[0].pathOps?.[0] as MergeOp;
    expect(merge).toMatchObject({ kind: "merge", mode: "subtract" });
    expect(merge.x).toBeCloseTo(1, 2);
    expect(merge.w).toBeCloseTo(0.5, 2);
    expect(image([{ op: "combine_shapes", layer_ids: ["card", "dot"], mode: "flatten", live: true }]).ok).toBe(false);
  });
});
