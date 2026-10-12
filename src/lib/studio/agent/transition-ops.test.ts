import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type Clip, type VideoDocument } from "../document";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { videoOutline } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, type VideoOpContext, type VideoOperation } from "./video-ops";

function media(id: string, startMs: number, durationMs: number, type: "video" | "image" | "audio" = "image"): Clip {
  return { ...newMediaClip(type, `m-${id}`, startMs, durationMs), id };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [media("a", 0, 2000), media("b", 2000, 2000)] },
    { id: "v2", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oferta"), 500, 3000), id: "title" }] },
    { id: "au", kind: "audio", clips: [media("song", 0, 4000, "audio")] },
  ];
  d.durationMs = 4000;
  return d;
}

const ctx: VideoOpContext = {
  playheadMs: 0,
  magnetic: false,
  mediaType: (id) => (id === "img-map" ? "image" : id === "vid-1" ? "video" : null),
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

function final(ops: VideoOperation[]): VideoDocument {
  const plan = run(ops);
  if (!plan.ok) throw new Error(plan.reason);
  expect(documentIssue("video", plan.final)).toBeNull();
  return plan.final;
}

function reason(ops: VideoOperation[]): string {
  const plan = run(ops);
  if (plan.ok) throw new Error("expected a refusal");
  return plan.reason;
}

const title = (d: VideoDocument) => d.tracks[1].clips[0];

describe("entrance and exit with any transition", () => {
  it("sets an entrance wipe and an exit gradient with their options", () => {
    const d = final([
      { op: "entrance", clip_id: "title", transition_kind: "venetianBlinds", angle: 90, piece_size: 0.2, softness: 0.3, duration_ms: 700 },
      { op: "exit", clip_id: "title", transition_kind: "gradientWipe", wipe_map: "clouds", softness: 0.4, easing: "easeIn" },
    ]);
    expect(title(d).transitionIn).toEqual({ kind: "venetianBlinds", durationMs: 700, easing: "linear", angle: 90, size: 0.2, softness: 0.3 });
    expect(title(d).transitionOut).toMatchObject({ kind: "gradientWipe", durationMs: 800, easing: "easeIn", map: "clouds", softness: 0.4 });
  });

  it("takes a library image as the gradient map and refuses anything else", () => {
    const d = final([{ op: "entrance", clip_id: "title", transition_kind: "gradientWipe", wipe_map_media_id: "img-map", reverse: true }]);
    expect(title(d).transitionIn).toMatchObject({ mapAssetId: "img-map", reverse: true });
    expect(title(d).transitionIn).not.toHaveProperty("map");
    expect(reason([{ op: "entrance", clip_id: "title", transition_kind: "gradientWipe", wipe_map_media_id: "vid-1" }])).toContain("imagem");
  });

  it("replaces the fade of that side and goes back to a fade with effect", () => {
    const faded = final([{ op: "entrance", clip_id: "title", effect: "fade", duration_ms: 300 }, { op: "entrance", clip_id: "title", transition_kind: "iris" }]);
    expect(title(faded)).toMatchObject({ fadeInMs: 0, transitionIn: { kind: "iris" } });
    const back = final([{ op: "entrance", clip_id: "title", transition_kind: "iris" }, { op: "entrance", clip_id: "title", effect: "fade", duration_ms: 300 }]);
    expect(title(back).fadeInMs).toBe(300);
    expect(title(back).transitionIn).toBeUndefined();
  });

  it("refuses an effect and a transition together, the plain dissolve, sounds and the slide side", () => {
    expect(reason([{ op: "entrance", clip_id: "title", effect: "fade", transition_kind: "wipe" }])).toContain("effect");
    expect(reason([{ op: "entrance", clip_id: "title", transition_kind: "dissolve" }])).toContain("fade");
    expect(reason([{ op: "exit", clip_id: "song", transition_kind: "wipe" }])).toContain("song");
    expect(reason([{ op: "entrance", clip_id: "title", transition_kind: "slide", moving: "out" }])).toContain("moving");
    expect(reason([{ op: "entrance", clip_id: "title", transition_kind: "wipe", piece_size: 0.2 }])).toContain("piece_size");
  });

  it("points to the cut transition when the edge already joins the neighbour", () => {
    const text = reason([
      { op: "add_transition", ref: "cut", clip_id: "a", transition_kind: "dissolve" },
      { op: "entrance", clip_id: "b", transition_kind: "wipe" },
    ]);
    expect(text).toContain("update_transition");
    expect(final([{ op: "exit", clip_id: "b", transition_kind: "blockDissolve" }]).tracks[0].clips[1].transitionOut).toMatchObject({ kind: "blockDissolve", size: 0.08 });
  });

  it("notes when a long entrance had to be shortened to fit the clip", () => {
    const plan = run([{ op: "entrance", clip_id: "title", transition_kind: "wipe", duration_ms: 4000 }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(title(plan.final).transitionIn?.durationMs).toBe(3000);
    expect(plan.notes.join(" ")).toContain("3000 ms");
  });

  it("adds the new wipes on a cut with their options", () => {
    const d = final([{ op: "add_transition", clip_id: "a", transition_kind: "radialWipe", angle: 180, origin_y: 1, softness: 0.25 }]);
    expect(d.tracks[0].transitions?.[0]).toMatchObject({ kind: "radialWipe", angle: 180, originY: 1, softness: 0.25 });
  });

  it("reads entrances and exits back in the outline with only the options in use", () => {
    const d = final([
      { op: "entrance", clip_id: "title", transition_kind: "gradientWipe", wipe_map: "radial", origin_x: 0.2 },
      { op: "add_transition", clip_id: "a", transition_kind: "gradientWipe", wipe_map_media_id: "img-map" },
    ]);
    const outline = videoOutline(d, { detail: "summary", playheadMs: 0, selection: [], jobs: [], asset: () => undefined });
    const clip = outline.tracks[1].clips[0];
    expect(clip.transition_in).toEqual({ kind: "gradientWipe", duration_ms: 800, easing: "linear", options: { wipe_map: "radial", origin_x: 0.2, origin_y: 0.5, softness: 0.2, reverse: false } });
    expect(outline.tracks[0].transitions?.[0].options).toEqual({ wipe_map_media_id: "img-map", softness: 0.2, reverse: false });
  });
});
