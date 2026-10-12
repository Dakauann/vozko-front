import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CAMERA_PROPERTIES } from "../clip-camera";
import { CAMERA_ARGS } from "./camera-ops";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "../document";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { outlineClip, type OutlineContext } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, type VideoOpContext, type VideoOperation } from "./video-ops";

function doc(): VideoDocument {
  const d = emptyVideoDocument("landscape");
  d.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "film", 0, 4000), id: "shot" }] }];
  d.durationMs = 4000;
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
  isLut: (id) => id === "look",
};

const outlineCtx: OutlineContext = { detail: "full", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] };

function run(ops: VideoOperation[]) {
  return planBatch(doc(), ops, (d, op) => applyVideoOperation(d, op, ctx), VIDEO_ID_FIELDS);
}

function final(ops: VideoOperation[]): VideoDocument {
  const plan = run(ops);
  if (!plan.ok) throw new Error(plan.reason);
  expect(documentIssue("video", plan.final)).toBeNull();
  return plan.final;
}

function refusal(ops: VideoOperation[]): string {
  const plan = run(ops);
  if (plan.ok) throw new Error("expected a refusal");
  return plan.reason;
}

const adjustment: VideoOperation = { op: "add_effect_clip", ref: "fx", at_ms: 0, duration_ms: 4000 };

function effectOf(d: VideoDocument) {
  return d.tracks.flatMap((track) => track.clips).find((clip) => clip.type === "effect")!;
}

const TOOLS = resolve(__dirname, "../../../../../vozko-back/usecases/copilot/copilottools/studiotools");

function goEnum(file: string, json: string): string[] {
  const source = readFileSync(resolve(TOOLS, file), "utf8");
  return new RegExp(`json:"${json}(?:,omitempty)?" (?:req:"true" )?enum:"([^"]+)"`).exec(source)?.[1].split(",") ?? [];
}

describe("the Go schema offers the camera Elo can use", () => {
  it("lists set_camera, the camera keys and every camera argument", () => {
    expect(goEnum("studio_edit_tools.go", "op")).toContain("set_camera");
    expect(goEnum("studio_edit_tools.go", "property")).toEqual(expect.arrayContaining([...CAMERA_PROPERTIES]));
    const source = readFileSync(resolve(TOOLS, "studio_camera_args.go"), "utf8");
    for (const arg of [...Object.values(CAMERA_ARGS), "clear_camera"]) expect(source).toContain(`json:"${arg},omitempty"`);
  });
});

describe("adjustment clips for Elo", () => {
  it("creates an empty adjustment and fills it with the color stack, blur, a mask and motion blur", () => {
    const d = final([
      adjustment,
      { op: "set_color", clip_id: "@fx", color_grade: { contrast: 25 }, curves_preset: "contrast", lut_media_id: "look", lut_intensity: 0.5, gradient_map: { preset: "sepia" } },
      { op: "update_clip", clip_id: "@fx", blur: 3, motion_blur: true },
      { op: "add_mask", clip_id: "@fx", mask_shape: "ellipse" },
      { op: "animate", clip_id: "@fx", property: "exposure", keys: [{ at_ms: 0, value: -1 }, { at_ms: 1000, value: 0 }] },
    ]);
    const fx = effectOf(d);
    expect(fx.vfx).toEqual([]);
    expect(fx.color).toMatchObject({ contrast: 25, lut: { assetId: "look", intensity: 0.5 } });
    expect(fx.color?.curves?.master).toBeDefined();
    expect(fx.gradientMap).toBeDefined();
    expect(fx).toMatchObject({ blur: 3, motionBlur: true });
    expect(fx.masks).toHaveLength(1);
    expect(fx.keyframes?.exposure).toHaveLength(2);
  });

  it("sets the camera, keys it at a moment once it is animated and clears it", () => {
    const placed = final([adjustment, { op: "set_camera", clip_id: "@fx", camera_zoom: 1.5, camera_pan_x: 0.1 }]);
    expect(effectOf(placed).camera).toEqual({ panX: 0.1, panY: 0, zoom: 1.5, rotation: 0 });
    const keyed = final([
      adjustment,
      { op: "animate", clip_id: "@fx", property: "cameraZoom", keys: [{ at_ms: 0, value: 1 }, { at_ms: 2000, value: 2 }] },
      { op: "set_camera", clip_id: "@fx", camera_zoom: 3, at_ms: 1000 },
    ]);
    expect(effectOf(keyed).keyframes?.cameraZoom?.map((key) => [key.atMs, key.value])).toEqual([
      [0, 1],
      [1000, 3],
      [2000, 2],
    ]);
    const cleared = final([adjustment, { op: "set_camera", clip_id: "@fx", camera_rotation: 10 }, { op: "animate", clip_id: "@fx", property: "cameraPanY", keys: [{ at_ms: 0, value: 0 }, { at_ms: 500, value: 0.2 }] }, { op: "set_camera", clip_id: "@fx", clear_camera: true }]);
    expect(effectOf(cleared).camera).toBeUndefined();
    expect(effectOf(cleared).keyframes).toBeUndefined();
  });

  it("refuses a camera off adjustment clips, values out of range, and keys it cannot place", () => {
    expect(refusal([{ op: "set_camera", clip_id: "shot", camera_zoom: 2 }])).toContain("clipes de efeito");
    expect(refusal([adjustment, { op: "set_camera", clip_id: "@fx", camera_zoom: 20 }])).toContain("camera_zoom vai de 0.1 a 10");
    expect(refusal([adjustment, { op: "set_camera", clip_id: "@fx" }])).toContain("set_camera precisa");
    expect(refusal([adjustment, { op: "animate", clip_id: "@fx", property: "cameraZoom", keys: [{ at_ms: 0, value: 1 }, { at_ms: 900, value: 2 }] }, { op: "set_camera", clip_id: "@fx", camera_zoom: 3 }])).toContain("mande at_ms");
    expect(refusal([{ op: "animate", clip_id: "shot", property: "cameraZoom", keys: [{ at_ms: 0, value: 1 }] }])).toContain("câmera de um clipe de efeito");
    expect(refusal([adjustment, { op: "animate", clip_id: "@fx", property: "x", keys: [{ at_ms: 0, value: 0.2 }] }])).toContain("um clipe de efeito anima só");
  });

  it("reads the camera, color, blur and masks back in the outline", () => {
    const d = final([adjustment, { op: "set_camera", clip_id: "@fx", camera_zoom: 2, camera_rotation: -5 }, { op: "set_color", clip_id: "@fx", color_grade: { saturation: -30 } }]);
    const line = outlineClip(findClip(d, effectOf(d).id)!.clip, outlineCtx);
    expect(line).toMatchObject({ type: "effect", camera: { pan_x: 0, pan_y: 0, zoom: 2, rotation: -5 }, color_grade: { saturation: -30 }, strength: 1 });
  });
});
