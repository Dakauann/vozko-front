import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { sourceSpanMs, speedAt } from "../clip-time";
import { CURVE_PRESET_IDS } from "../color-curves";
import { emptyArtboard, emptyVideoDocument, IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, newImageLayer, newMediaClip, type ImageDocument, type VideoDocument } from "../document";
import { HUE_NAMES } from "../hue-secondary";
import { SPEED_CURVE_PRESET_IDS } from "../speed-curve";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { COLOR_CLEARS } from "./color-op";
import { applyImageOperation, IMAGE_ID_FIELDS, type ImageOperation } from "./image-ops";
import { videoOutline } from "./outline";
import { RAMP_MODES } from "./speed-ops";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

const TOOLS = resolve(__dirname, "../../../../../vozko-back/usecases/copilot/copilottools/studiotools");

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v", kind: "visual", clips: [{ ...newMediaClip("video", "m-shot", 0, 4000), id: "shot", linkId: "pair" }, { ...newMediaClip("image", "m-still", 4000, 2000), id: "still" }] },
    { id: "a", kind: "audio", clips: [{ ...newMediaClip("audio", "m-shot", 0, 4000), id: "sound", linkId: "pair" }] },
  ];
  d.durationMs = 6000;
  return d;
}

const CTX: VideoOpContext = {
  playheadMs: 0,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => undefined,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: () => undefined,
  isLut: (id) => id === "look-1",
};

function run(start: VideoDocument, ops: VideoOperation[], ctx: VideoOpContext = CTX) {
  return planBatch(start, ops, (current, op) => applyVideoOperation(current, op, ctx), VIDEO_ID_FIELDS, videoIds);
}

function goEnum(file: string, json: string): string[] {
  const source = readFileSync(resolve(TOOLS, file), "utf8");
  return new RegExp(`json:"${json}(?:,omitempty)?" (?:req:"true" )?enum:"([^"]+)"`).exec(source)?.[1].split(",") ?? [];
}

describe("Elo colors clips with curves, a secondary, a LUT and a gradient map", () => {
  it("applies every color part in one step, reads it back and keeps it valid", () => {
    const plan = run(doc(), [
      {
        op: "set_color",
        clip_id: "shot",
        color_grade: { exposure: 0.3 },
        curves_preset: "contrast",
        curves: { blue: [{ x: 0, y: 0.1 }, { x: 1, y: 0.9 }] },
        hsl: { color: "red", desaturate: 100 },
        lut_media_id: "look-1",
        lut_intensity: 0.5,
        gradient_map: { preset: "noite", intensity: 0.4 },
      },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    const shot = findClip(plan.final, "shot")!.clip;
    expect(shot.color?.curves?.master?.length).toBe(4);
    expect(shot.color?.hsl).toEqual({ hue: 0, width: 40, softness: 30, desaturate: 100 });
    expect(shot.color?.lut).toEqual({ assetId: "look-1", intensity: 0.5 });
    expect(shot.gradientMap?.intensity).toBe(0.4);
    expect(documentIssue("video", plan.final)).toBeNull();
    const outline = videoOutline(plan.final, { detail: "full", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] });
    const clip = outline.tracks.flatMap((track) => track.clips).find((entry) => entry.id === "shot")!;
    expect(clip.color_grade?.lut).toEqual({ media_id: "look-1", intensity: 0.5 });
    expect(clip.gradient_map?.intensity).toBe(0.4);
  });

  it("refuses an unreadable LUT, bad curves and unknown choices with a reason", () => {
    const reason = (op: VideoOperation) => {
      const plan = run(doc(), [op]);
      return plan.ok ? null : plan.reason;
    };
    expect(reason({ op: "set_color", clip_id: "shot", lut_media_id: "song.mp3" })).toContain("LUT .cube");
    expect(reason({ op: "set_color", clip_id: "shot", curves: { master: [{ x: 0.5, y: 0.5 }] } })).toContain("pelo menos 2 pontos");
    expect(reason({ op: "set_color", clip_id: "shot", hsl: { hue: 400 } })).toContain("hsl.hue");
    expect(reason({ op: "set_color", clip_id: "shot", clear_color: ["mask" as never] })).toContain("clear_color");
    expect(reason({ op: "set_color", clip_id: "shot", lut_intensity: 0.5 })).toContain("lut_media_id");
  });

  it("clears parts and keeps the rest, and a look keeps curves", () => {
    const set = run(doc(), [{ op: "set_color", clip_id: "shot", curves_preset: "fade", hsl: { color: "blue", desaturate: 80 } }]);
    if (!set.ok) throw new Error(set.reason);
    const looked = run(set.final, [{ op: "set_color", clip_id: "shot", look: "warm" }, { op: "set_color", clip_id: "shot", clear_color: ["hsl"] }]);
    if (!looked.ok) throw new Error(looked.reason);
    const shot = findClip(looked.final, "shot")!.clip;
    expect(shot.color?.curves).toBeDefined();
    expect(shot.color?.hsl).toBeUndefined();
    expect(shot.color?.temperature).toBe(35);
  });

  it("colors image layers with the same fields", () => {
    const board = { ...emptyArtboard({ width: 400, height: 400 }), id: "main", layers: [{ ...newImageLayer("m-photo", { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 }), id: "photo" }] };
    const image: ImageDocument = { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards: [board] };
    const ops: ImageOperation[] = [{ op: "set_color", layer_id: "photo", curves_preset: "brighten", hsl: { color: "green", shift: 40 } }];
    const plan = planBatch(image, ops, (current, op) => applyImageOperation(current, op, { naturalSize: () => undefined, icons: [], activeArtboard: "main" }), IMAGE_ID_FIELDS);
    if (!plan.ok) throw new Error(plan.reason);
    const photo = plan.final.artboards[0].layers.find((layer) => layer.id === "photo")!;
    expect(photo.color?.curves?.master).toBeDefined();
    expect(photo.color?.hsl?.shift).toBe(40);
  });

  it("animates the grade only on media clips", () => {
    const plan = run(doc(), [{ op: "animate", clip_id: "shot", property: "exposure", keys: [{ at_ms: 0, value: -2 }, { at_ms: 1000, value: 0 }] }]);
    if (!plan.ok) throw new Error(plan.reason);
    expect(findClip(plan.final, "shot")!.clip.keyframes?.exposure?.length).toBe(2);
    const sound = run(doc(), [{ op: "animate", clip_id: "sound", property: "exposure", keys: [{ at_ms: 0, value: 1 }] }]);
    expect(sound.ok).toBe(false);
  });
});

describe("Elo shapes speed with curves", () => {
  it("sets a preset curve that keeps the footage and moves the linked sound with it", () => {
    const plan = run(doc(), [{ op: "set_speed_curve", clip_id: "shot", speed_curve_preset: "hero" }]);
    if (!plan.ok) throw new Error(plan.reason);
    const shot = findClip(plan.final, "shot")!.clip;
    expect(Math.abs(sourceSpanMs(shot) - 4000)).toBeLessThanOrEqual(2);
    expect(findClip(plan.final, "sound")!.clip.keyframes?.speed).toEqual(shot.keyframes?.speed);
    expect(findClip(plan.final, "still")!.clip.startMs).toBe(shot.durationMs);
    const outline = videoOutline(plan.final, { detail: "summary", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] });
    const clip = outline.tracks.flatMap((track) => track.clips).find((entry) => entry.id === "shot")!;
    expect(clip.speed_curve?.points.map((point) => point.speed)).toEqual([1.5, 0.3, 0.3, 1.5]);
    expect(clip.speed_curve?.smooth).toBe(true);
  });

  it("takes drawn points, refuses points that do not cover the clip and clears back to a constant speed", () => {
    const drawn = run(doc(), [{ op: "set_speed_curve", clip_id: "shot", speed_points: [{ at: 1, speed: 0.5 }, { at: 0, speed: 2 }], smooth: false, keep_duration: true }]);
    if (!drawn.ok) throw new Error(drawn.reason);
    expect(findClip(drawn.final, "shot")!.clip.durationMs).toBe(4000);
    expect(speedAt(findClip(drawn.final, "shot")!.clip, 2000)).toBeCloseTo(1.25, 6);
    const bad = run(doc(), [{ op: "set_speed_curve", clip_id: "shot", speed_points: [{ at: 0.2, speed: 1 }, { at: 1, speed: 2 }] }]);
    expect(!bad.ok && bad.reason).toContain("speed_points");
    const cleared = run(drawn.final, [{ op: "set_speed_curve", clip_id: "shot", clear_speed_curve: true }]);
    if (!cleared.ok) throw new Error(cleared.reason);
    expect(findClip(cleared.final, "shot")!.clip.keyframes?.speed).toBeUndefined();
  });

  it("ramps smoothly by default, in steps when asked, and turns frame mix on", () => {
    const smooth = run(doc(), [{ op: "speed_ramp", clip_id: "shot", speed: 0.5, ramp_ms: 800, at_ms: 1000 }]);
    if (!smooth.ok) throw new Error(smooth.reason);
    expect(smooth.final.tracks[0].clips.filter((clip) => clip.assetId === "m-shot")).toHaveLength(1);
    const steps = run(doc(), [{ op: "speed_ramp", clip_id: "shot", speed: 0.5, ramp_ms: 800, at_ms: 1000, ramp_mode: "steps" }]);
    if (!steps.ok) throw new Error(steps.reason);
    expect(steps.final.tracks[0].clips.filter((clip) => clip.assetId === "m-shot").length).toBeGreaterThan(1);
    const mixed = run(doc(), [{ op: "set_speed", clip_id: "shot", frame_mix: true }]);
    if (!mixed.ok) throw new Error(mixed.reason);
    expect(findClip(mixed.final, "shot")!.clip.frameMix).toBe(true);
    expect(run(doc(), [{ op: "set_speed", clip_id: "still", frame_mix: true }]).ok).toBe(false);
  });

  it("animates speed keys directly and keeps the duration", () => {
    const plan = run(doc(), [{ op: "animate", clip_id: "shot", property: "speed", keys: [{ at_ms: 0, value: 1 }, { at_ms: 4000, value: 3 }] }]);
    if (!plan.ok) throw new Error(plan.reason);
    expect(findClip(plan.final, "shot")!.clip.durationMs).toBe(4000);
    expect(findClip(plan.final, "sound")!.clip.keyframes?.speed?.length).toBe(2);
    expect(run(doc(), [{ op: "animate", clip_id: "still", property: "speed", keys: [{ at_ms: 0, value: 2 }] }]).ok).toBe(false);
  });
});

describe("the color and speed choices match the backend schema", () => {
  it("lists the same values on both sides", () => {
    expect(goEnum("studio_color_args.go", "ramp_mode")).toEqual([...RAMP_MODES]);
    expect(goEnum("studio_color_args.go", "speed_curve_preset")).toEqual([...SPEED_CURVE_PRESET_IDS]);
    expect(goEnum("studio_color_args.go", "color")).toEqual([...HUE_NAMES]);
    expect(goEnum("studio_edit_tools.go", "curves_preset")).toEqual([...CURVE_PRESET_IDS]);
    expect(goEnum("studio_edit_tools.go", "clear_color")).toEqual([...COLOR_CLEARS]);
  });
});
