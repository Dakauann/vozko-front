import { describe, expect, it } from "vitest";

import { canvasAspect, emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "../document";
import { placementAt } from "../clip-placement";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { outlineClip } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, type VideoOpContext, type VideoOperation } from "./video-ops";

function clip(id: string, type: Clip["type"] = "image"): Clip {
  return { ...newMediaClip(type === "audio" ? "audio" : "image", `m-${id}`, 0, 2000), id, transform: { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 30, opacity: 1 } };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("landscape");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [clip("p")] },
    { id: "au", kind: "audio", clips: [clip("s", "audio")] },
  ];
  d.durationMs = 2000;
  return d;
}

const ctx: VideoOpContext = {
  playheadMs: 500,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => 10_000,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: () => undefined,
};

function run(ops: VideoOperation[], base: VideoDocument = doc()) {
  return planBatch(base, ops, (d, op) => applyVideoOperation(d, op, ctx), VIDEO_ID_FIELDS);
}

function finalClip(plan: ReturnType<typeof run>, id: string): Clip {
  if (!plan.ok) throw new Error(plan.reason);
  expect(documentIssue("video", plan.final)).toBeNull();
  return findClip(plan.final, id)!.clip;
}

describe("anchor, flips and orientation", () => {
  it("moves the anchor to a named point and keeps the picture in place", () => {
    const before = placementAt(clip("p"), 500, canvasAspect(doc()));
    const plan = run([{ op: "set_anchor", clip_id: "p", anchor: "bottom-left" }]);
    const moved = finalClip(plan, "p");
    expect(moved.anchor).toEqual({ x: 0, y: 1 });
    const after = placementAt(moved, 500, canvasAspect(doc()));
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it("takes exact anchor numbers, can move only the pivot and refuses sounds and wild values", () => {
    expect(finalClip(run([{ op: "set_anchor", clip_id: "p", anchor_x: 0.25, anchor_y: 0.5, keep_visual: false }]), "p")).toMatchObject({ anchor: { x: 0.25, y: 0.5 }, transform: { x: 0.5, y: 0.5 } });
    const sound = run([{ op: "set_anchor", clip_id: "s", anchor: "center" }]);
    expect(sound.ok).toBe(false);
    const wild = run([{ op: "set_anchor", clip_id: "p", anchor_x: 3 }]);
    expect(wild.ok).toBe(false);
    if (!wild.ok) expect(wild.reason).toContain("anchor_x");
  });

  it("flips and orients through update_clip and reads them back", () => {
    const flipped = finalClip(run([{ op: "update_clip", clip_id: "p", flip_x: true, flip_y: true, auto_orient: true }]), "p");
    expect(flipped).toMatchObject({ flipX: true, flipY: true, autoOrient: true });
    expect(outlineClip({ ...flipped, anchor: { x: 0, y: 1 } }, { detail: "summary", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] })).toMatchObject({ flip_x: true, flip_y: true, auto_orient: true, anchor: { x: 0, y: 1 } });
    const notes = run([{ op: "update_clip", clip_id: "p", auto_orient: true }]);
    if (notes.ok) expect(notes.notes.join(" ")).toContain("auto_orient");
  });
});

describe("scale axes and curved paths", () => {
  it("animates one axis and replaces a uniform scale with a note", () => {
    const plan = run([
      { op: "animate", clip_id: "p", property: "scale", keys: [{ at_ms: 0, value: 1 }, { at_ms: 1000, value: 2 }] },
      { op: "animate", clip_id: "p", property: "scaleX", keys: [{ at_ms: 0, value: 1 }, { at_ms: 1000, value: 1.5 }] },
    ]);
    const stretched = finalClip(plan, "p");
    expect(stretched.keyframes?.scale).toBeUndefined();
    expect(stretched.keyframes?.scaleX?.map((k) => k.value)).toEqual([1, 1.5]);
    if (plan.ok) expect(plan.notes.join(" ")).toContain("substituiu");
  });

  it("splits and links the scale axes, asking which axis to keep when they differ", () => {
    const split = finalClip(run([{ op: "animate", clip_id: "p", property: "scale", keys: [{ at_ms: 0, value: 1 }, { at_ms: 1000, value: 2 }] }, { op: "scale_axes", clip_id: "p", separate: true }]), "p");
    expect(split.keyframes?.scaleX).toEqual(split.keyframes?.scaleY);
    const base = { ...doc() };
    base.tracks[0].clips[0] = { ...clip("p"), keyframes: { scaleX: [{ atMs: 0, value: 1, easing: "linear" }], scaleY: [{ atMs: 0, value: 2, easing: "linear" }] } };
    const unsure = run([{ op: "scale_axes", clip_id: "p", separate: false }], base);
    expect(unsure.ok).toBe(false);
    expect(finalClip(run([{ op: "scale_axes", clip_id: "p", separate: false, keep_axis: "y" }], base), "p").keyframes).toEqual({ scale: [{ atMs: 0, value: 2, easing: "linear" }] });
  });

  it("animates a curved path with handles filled from the curve for smooth keys", () => {
    const plan = run([
      {
        op: "animate",
        clip_id: "p",
        property: "position",
        keys: [
          { at_ms: 0, x: 0.2, y: 0.8 },
          { at_ms: 1000, x: 0.5, y: 0.2, spatial: "smooth" },
          { at_ms: 2000, x: 0.8, y: 0.8, spatial: "free", in: { x: -0.1, y: -0.2 }, out: { x: 0, y: 0 } },
        ],
      },
    ]);
    const keys = finalClip(plan, "p").keyframes!.position!;
    expect(keys[1].in!.x).toBeLessThan(0);
    expect(keys[1].out!.x).toBeGreaterThan(0);
    expect(keys[2]).toMatchObject({ spatial: "free", in: { x: -0.1, y: -0.2 } });
    const broken = run([{ op: "animate", clip_id: "p", property: "position", keys: [{ at_ms: 0, x: 0.2 }] }]);
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.reason).toContain("x e y");
  });

  it("turns x and y into a curved path and back", () => {
    const curved = finalClip(
      run([
        { op: "animate", clip_id: "p", property: "x", keys: [{ at_ms: 0, value: 0.2 }, { at_ms: 2000, value: 0.8 }] },
        { op: "animate", clip_id: "p", property: "y", keys: [{ at_ms: 0, value: 0.8 }, { at_ms: 1000, value: 0.2 }, { at_ms: 2000, value: 0.8 }] },
        { op: "set_path", clip_id: "p", curved: true },
      ]),
      "p",
    );
    expect(curved.keyframes?.position?.map((k) => k.atMs)).toEqual([0, 1000, 2000]);
    expect(curved.keyframes?.x).toBeUndefined();
    const base = doc();
    base.tracks[0].clips[0] = curved;
    const straight = finalClip(run([{ op: "set_path", clip_id: "p", curved: false }], base), "p");
    expect(straight.keyframes?.position).toBeUndefined();
    expect(straight.keyframes?.x?.length).toBeGreaterThan(2);
    expect(run([{ op: "set_path", clip_id: "p", curved: true }]).ok).toBe(false);
  });
});
