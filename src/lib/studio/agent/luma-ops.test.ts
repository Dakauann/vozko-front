import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "../document";
import { LUMA_DEFAULTS } from "../luma-key";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { videoOutline } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

function film(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "m-a", 0, 2000), id: "a" }] },
    { id: "v2", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oi"), 0, 2000), id: "t" }] },
    { id: "v3", kind: "visual", clips: [{ ...newMediaClip("image", "m-b", 0, 2000), id: "b" }] },
  ];
  d.durationMs = 2000;
  return d;
}

const ctx: VideoOpContext = {
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

function run(ops: VideoOperation[], base: VideoDocument = film()) {
  return planBatch(base, ops, (d, op) => applyVideoOperation(d, op, ctx), VIDEO_ID_FIELDS, videoIds);
}

const clipOf = (d: VideoDocument, id: string) => findClip(d, id)!.clip;

describe("luma key operations", () => {
  it("turns the key on, tunes it, animates it and removes it", () => {
    const on = run([{ op: "set_luma_key", clip_id: "a", luma_mode: "light", luma_threshold: 0.2 }]);
    if (!on.ok) throw new Error(on.reason);
    expect(clipOf(on.final, "a").lumaKey).toEqual({ mode: "light", threshold: 0.2, softness: LUMA_DEFAULTS.softness });
    const animated = run([{ op: "animate_luma", clip_id: "a", luma_property: "softness", keys: [{ at_ms: 0, value: 0.05 }, { at_ms: 1000, value: 0.4 }] }], on.final);
    if (!animated.ok) throw new Error(animated.reason);
    expect(clipOf(animated.final, "a").lumaKey?.keyframes?.softness).toHaveLength(2);
    const removed = run([{ op: "remove_luma_key", clip_id: "a" }], animated.final);
    expect(removed.ok && clipOf(removed.final, "a").lumaKey).toBeUndefined();
  });

  it("explains what is wrong instead of guessing", () => {
    const onText = run([{ op: "set_luma_key", clip_id: "t" }]);
    expect(!onText.ok && onText.reason).toContain("não é vídeo nem imagem");
    const range = run([{ op: "set_luma_key", clip_id: "a", luma_softness: 0 }]);
    expect(!range.ok && range.reason).toContain("luma_softness vai de 0.001 a 1");
    const mode = run([{ op: "set_luma_key", clip_id: "a", luma_mode: "gray" as "dark" }]);
    expect(!mode.ok && mode.reason).toContain("luma_mode");
    const animated = run([{ op: "animate_luma", clip_id: "a", luma_property: "threshold", keys: [{ at_ms: 0, value: 0.1 }] }, { op: "set_luma_key", clip_id: "a", luma_threshold: 0.3 }]);
    expect(!animated.ok && animated.reason).toContain("at_ms");
    const off = run([{ op: "animate_luma", clip_id: "a", keys: [] }]);
    expect(!off.ok && off.reason).toContain("luma_property");
  });
});

describe("blend modes and mattes through update_clip", () => {
  it("sets the blend mode of a video on the clip and of a text on its layer", () => {
    const result = run([
      { op: "update_clip", clip_id: "a", blend_mode: "add" },
      { op: "update_clip", clip_id: "t", blend_mode: "screen" },
    ]);
    if (!result.ok) throw new Error(result.reason);
    expect(clipOf(result.final, "a").blendMode).toBe("add");
    expect(clipOf(result.final, "a").layer).toBeUndefined();
    expect(clipOf(result.final, "t").layer?.blendMode).toBe("screen");
    expect(documentIssue("video", result.final)).toBeNull();
    const cleared = run([{ op: "update_clip", clip_id: "a", clear: ["blend_mode"] }], result.final);
    expect(cleared.ok && clipOf(cleared.final, "a").blendMode).toBeUndefined();
  });

  it("turns on a luma matte, inverts it and turns it off", () => {
    const luma = run([{ op: "update_clip", clip_id: "b", matte_channel: "luma", matte_invert: true }]);
    if (!luma.ok) throw new Error(luma.reason);
    expect(clipOf(luma.final, "b")).toMatchObject({ matte: true, matteChannel: "luma", matteInvert: true });
    const plain = run([{ op: "update_clip", clip_id: "b", matte_channel: "alpha", matte_invert: false }], luma.final);
    if (!plain.ok) throw new Error(plain.reason);
    expect(clipOf(plain.final, "b")).toMatchObject({ matte: true });
    expect(clipOf(plain.final, "b").matteChannel).toBeUndefined();
    expect(clipOf(plain.final, "b").matteInvert).toBeUndefined();
    const off = run([{ op: "update_clip", clip_id: "b", matte: false }], luma.final);
    expect(off.ok && clipOf(off.final, "b").matte).toBeUndefined();
    const mixed = run([{ op: "update_clip", clip_id: "b", matte: false, matte_channel: "luma" }]);
    expect(!mixed.ok && mixed.reason).toContain("matte false");
    const unknown = run([{ op: "update_clip", clip_id: "b", matte_channel: "red" as "luma" }]);
    expect(!unknown.ok && unknown.reason).toContain("matte_channel");
  });

  it("reads the compositing back in the outline", () => {
    const result = run([
      { op: "update_clip", clip_id: "b", blend_mode: "add", matte_channel: "luma", matte_invert: true },
      { op: "set_luma_key", clip_id: "a" },
    ]);
    if (!result.ok) throw new Error(result.reason);
    const outline = videoOutline(result.final, { detail: "full", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] });
    const clips = outline.tracks.flatMap((track) => track.clips);
    expect(clips.find((clip) => clip.id === "b")).toMatchObject({ blend_mode: "add", matte: true, matte_channel: "luma", matte_invert: true });
    expect(clips.find((clip) => clip.id === "a")?.luma_key).toEqual({ mode: "dark", threshold: LUMA_DEFAULTS.threshold, softness: LUMA_DEFAULTS.softness });
  });
});
