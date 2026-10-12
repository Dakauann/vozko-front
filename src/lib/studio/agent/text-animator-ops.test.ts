import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type Clip, type VideoDocument } from "../document";
import { TEXT_ANIMATOR_PRESETS } from "../text-animator";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { videoOutline } from "./outline";
import { TEXT_ANIMATOR_OPERATIONS } from "./text-animator-ops";
import { applyVideoOperation, VIDEO_OPERATIONS, type VideoOpContext, type VideoOperation } from "./video-ops";

function film(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "m-a", 0, 2000), id: "photo" }] },
    { id: "v2", kind: "visual", clips: [{ ...newOverlayClip({ ...newTextLayer("Oferta de hoje"), fill: "#ffffff" }, 0, 2000), id: "title" }] },
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

function run(op: Partial<VideoOperation>, doc: VideoDocument = film()) {
  return applyVideoOperation(doc, { op: "select", ...op } as VideoOperation, ctx);
}

function done(op: Partial<VideoOperation>, doc?: VideoDocument): VideoDocument {
  const outcome = run(op, doc);
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.document;
}

const title = (doc: VideoDocument): Clip => findClip(doc, "title")!.clip;

describe("text animator operations", () => {
  it("are video operations", () => {
    for (const name of TEXT_ANIMATOR_OPERATIONS) expect(VIDEO_OPERATIONS).toContain(name);
  });

  it("offers Elo the same presets the editor builds", () => {
    const source = readFileSync(resolve(__dirname, "../../../../../vozko-back/usecases/copilot/copilottools/studiotools/studio_text_animator_args.go"), "utf8");
    const presets = /json:"animator_preset,omitempty" enum:"([^"]+)"/.exec(source)?.[1].split(",");
    expect(presets).toEqual([...TEXT_ANIMATOR_PRESETS]);
  });

  it("adds every preset expanded into values", () => {
    for (const preset of TEXT_ANIMATOR_PRESETS) {
      const doc = done({ op: "add_text_animator", clip_id: "title", animator_preset: preset, selector_seed: 4 });
      const [animator] = title(doc).textAnimators!;
      expect(animator).not.toHaveProperty("preset");
      expect(animator.selector.seed).toBe(4);
      expect(documentIssue("video", doc)).toBeNull();
    }
  });

  it("builds a custom range animator from fields", () => {
    const doc = done({ op: "add_text_animator", clip_id: "title", unit: "word", animator_properties: { y: 40, opacity: 0, rotation: -10 }, range_order: "edgesIn", range_shape: "round", range_end: 40, ease_high: 50, selector_amount: 80 });
    expect(title(doc).textAnimators![0]).toMatchObject({ unit: "word", properties: { y: 40, opacity: 0, rotation: -10 }, selector: { kind: "range", order: "edgesIn", shape: "round", end: 40, easeHigh: 50, amount: 80 } });
  });

  it("builds a looping wiggle", () => {
    const doc = done({ op: "add_text_animator", clip_id: "title", selector_kind: "wiggly", animator_properties: { x: 6, rotation: 8 }, wiggly_rate: 4, wiggly_loop_ms: 1000, wiggly_correlation: 20 });
    expect(title(doc).textAnimators![0].selector).toMatchObject({ kind: "wiggly", rate: 4, loopMs: 1000, correlation: 20 });
  });

  it("updates, keys, moves and removes an animator", () => {
    let doc = done({ op: "add_text_animator", clip_id: "title", animator_preset: "cascadeIn" });
    doc = done({ op: "add_text_animator", clip_id: "title", animator_preset: "wiggle" }, doc);
    const [first, second] = title(doc).textAnimators!;
    doc = done({ op: "update_text_animator", clip_id: "title", animator_id: first.id, range_shape: "smooth", remove_properties: ["opacity"], animator_properties: { scale: 0 } }, doc);
    expect(title(doc).textAnimators![0]).toMatchObject({ properties: { scale: 0 }, selector: { shape: "smooth" } });
    expect(title(doc).textAnimators![0].properties).not.toHaveProperty("opacity");
    doc = done({ op: "update_text_animator", clip_id: "title", animator_id: first.id, range_offset: 10, at_ms: 400 }, doc);
    expect(title(doc).textAnimators![0].keyframes?.offset?.map((key) => key.atMs)).toContain(400);
    doc = done({ op: "animate_text_animator", clip_id: "title", animator_id: second.id, selector_property: "amount", keys: [{ at_ms: 0, value: 0 }, { at_ms: 1500, value: 100, easing: "easeOut" }] }, doc);
    expect(title(doc).textAnimators![1].keyframes?.amount).toHaveLength(2);
    doc = done({ op: "move_text_animator", clip_id: "title", animator_id: second.id, to_index: 0 }, doc);
    expect(title(doc).textAnimators!.map((a) => a.id)).toEqual([second.id, first.id]);
    doc = done({ op: "remove_text_animator", clip_id: "title", animator_id: second.id }, doc);
    expect(title(doc).textAnimators!.map((a) => a.id)).toEqual([first.id]);
    expect(documentIssue("video", doc)).toBeNull();
  });

  it("explains each refusal", () => {
    const refused = (op: Partial<VideoOperation>, doc?: VideoDocument) => {
      const outcome = run(op, doc);
      return outcome.ok ? "" : outcome.reason;
    };
    expect(refused({ op: "add_text_animator", clip_id: "photo", animator_preset: "wave" })).toContain("não é um texto");
    expect(refused({ op: "add_text_animator", clip_id: "title", animator_properties: { scale: 5000 } })).toContain("scale vai de 0 a 1000");
    expect(refused({ op: "add_text_animator", clip_id: "title", animator_properties: { stroke: "#ff0000" } })).toContain("stroke");
    expect(refused({ op: "add_text_animator", clip_id: "title", selector_kind: "wiggly", range_order: "random" })).toContain("selector_kind range");
    const keyed = done({ op: "add_text_animator", clip_id: "title", animator_preset: "cascadeIn" });
    expect(refused({ op: "update_text_animator", clip_id: "title", range_offset: 10 }, keyed)).toContain("at_ms");
    expect(refused({ op: "animate_text_animator", clip_id: "title", selector_property: "offset", keys: [{ at_ms: 0, value: 400 }] }, keyed)).toContain("offset vai de -100 a 100");
    const two = done({ op: "add_text_animator", clip_id: "title", animator_preset: "wave" }, keyed);
    expect(refused({ op: "remove_text_animator", clip_id: "title" }, two)).toContain("animator_id");
  });

  it("shows the animators in the outline with op field names", () => {
    const doc = done({ op: "add_text_animator", clip_id: "title", animator_preset: "cascadeIn", selector_seed: 3 });
    const outline = videoOutline(doc, { detail: "full", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] });
    const text = JSON.stringify(outline);
    expect(text).toContain("text_animators");
    expect(text).toContain("range_shape");
    expect(text).toContain("\"selector_seed\":3");
    expect(text).toContain("\"offset\":[{\"at_ms\":0");
  });
});
