import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyVideoDocument, fullFrame, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "./document";
import { visualPlan } from "./playback";
import { videoScene } from "./scene/video-scene";
import { findClip, splitClip } from "./timeline";
import { documentIssue } from "./validate";

import {
  flareFlicker,
  flareGhosts,
  freshVfx,
  glitchBurst,
  grainFrame,
  hash01,
  keyedParams,
  hash32,
  leakBlobs,
  listensToTrack,
  newEffectClip,
  newVfx,
  noise1,
  setVfxKey,
  shakeAt,
  shakeCover,
  vfxColors,
  vfxIssue,
  vfxLook,
  vfxLooks,
  vfxParams,
  vfxValue,
  vignetteWeight,
  VFX_KINDS,
  VFX_SPECS,
  usesSeed,
  VFX_SEED_RANGE,
  type Vfx,
} from "./vfx";

const look = (vfx: Vfx, timeMs: number) => vfxLook(vfx, timeMs);

describe("vfx specs", () => {
  it("gives every kind an amount and keeps every default inside its range", () => {
    expect(vfxParams("posterizeTime")).toEqual(["rate"]);
    for (const kind of VFX_KINDS) {
      if (kind !== "posterizeTime") expect(vfxParams(kind)).toContain("amount");
      for (const param of vfxParams(kind)) {
        const spec = VFX_SPECS[kind].params[param]!;
        expect(spec.fallback).toBeGreaterThanOrEqual(spec.range[0]);
        expect(spec.fallback).toBeLessThanOrEqual(spec.range[1]);
      }
      for (const color of vfxColors(kind)) expect(VFX_SPECS[kind].colors[color]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("creates an effect with only its id, kind and seed", () => {
    expect(newVfx("grain", "fx1", 7)).toEqual({ id: "fx1", kind: "grain", seed: 7 });
  });

  it("creates a fresh effect with a new id and a seed in range", () => {
    const first = freshVfx("particles");
    const second = freshVfx("particles");
    expect(first.kind).toBe("particles");
    expect(first.id).not.toBe(second.id);
    expect(Number.isInteger(first.seed)).toBe(true);
    expect(first.seed).toBeGreaterThanOrEqual(VFX_SEED_RANGE[0]);
    expect(first.seed).toBeLessThanOrEqual(VFX_SEED_RANGE[1]);
    expect(vfxIssue([first, second])).toBeNull();
  });

  it("knows which kinds draw from their seed", () => {
    expect(VFX_KINDS.filter((kind) => usesSeed(kind))).toEqual(["grain", "lightLeak", "glitch", "particles", "lensFlare", "shake", "fractalNoise"]);
  });

  it("creates an effect clip that fills the frame and carries its effects", () => {
    const clip = newEffectClip([newVfx("glitch", "fx", 1)], 1000, 2000);
    expect(clip.type).toBe("effect");
    expect(clip.startMs).toBe(1000);
    expect(clip.durationMs).toBe(2000);
    expect(clip.vfx?.map((vfx) => vfx.id)).toEqual(["fx"]);
    expect(clip.transform).toEqual({ x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 });
  });
});

describe("vfx values", () => {
  it("reads the default, then the stored value, then the keyed value", () => {
    const grain = newVfx("grain", "g", 1);
    expect(vfxValue(grain, "amount", 0)).toBe(0.35);
    expect(vfxValue({ ...grain, params: { amount: 0 } }, "amount", 0)).toBe(0);
    const keyed = setVfxKey(setVfxKey(grain, "amount", 0, 0), "amount", 1000, 1);
    expect(vfxValue(keyed, "amount", 500)).toBeCloseTo(0.5);
  });

  it("resolves a look with every parameter and color of the kind and skips hidden effects", () => {
    const leak = { ...newVfx("lightLeak", "l", 3), colors: { color: "#112233" } };
    const resolved = look(leak, 250);
    expect(Object.keys(resolved.values).sort()).toEqual([...vfxParams("lightLeak")].sort());
    expect(resolved.colors).toEqual({ color: "#112233", color2: VFX_SPECS.lightLeak.colors.color2 });
    expect(resolved.timeMs).toBe(250);
    expect(vfxLooks([leak, { ...newVfx("grain", "h", 1), hidden: true }], 0).map((entry) => entry.id)).toEqual(["l"]);
  });
});

describe("vfx validation", () => {
  const valid = (list: Vfx[]) => vfxIssue(list);

  it("accepts every kind with its defaults and full parameter sets", () => {
    const full = VFX_KINDS.map((kind, i) => ({
      ...newVfx(kind, `fx${i}`, i),
      params: Object.fromEntries(vfxParams(kind).map((param) => [param, VFX_SPECS[kind].params[param]!.range[1]])),
      ...(listensToTrack(kind) ? { trackId: "music" } : {}),
    }));
    expect(valid(full)).toBeNull();
  });

  it("refuses unknown kinds, foreign parameters, values out of range, bad colors, seeds and duplicate ids", () => {
    expect(valid([{ ...newVfx("grain", "a", 1), kind: "smoke" as never }])).toBe("unknown");
    expect(valid([{ ...newVfx("grain", "a", 1), params: { ghosts: 0.5 } }])).toBe("invalid");
    expect(valid([{ ...newVfx("grain", "a", 1), params: { amount: 2 } }])).toBe("out_of_range");
    expect(valid([{ ...newVfx("grain", "a", 1), colors: { color: "#fff" } }])).toBe("invalid");
    expect(valid([{ ...newVfx("vignette", "a", 1), colors: { color: "red" } }])).toBe("invalid");
    expect(valid([{ ...newVfx("grain", "a", 1.5) }])).toBe("out_of_range");
    expect(valid([{ ...newVfx("grain", "a", -1) }])).toBe("out_of_range");
    expect(valid([newVfx("grain", "a", 1), newVfx("glitch", "a", 2)])).toBe("invalid");
    expect(valid([newVfx("grain", "bad id", 1)])).toBe("invalid");
  });

  it("checks keyframe lanes against the parameters of the kind", () => {
    const keyed = setVfxKey(newVfx("grain", "a", 1), "amount", 0, 0.2);
    expect(valid([keyed])).toBeNull();
    expect(valid([{ ...keyed, keyframes: { ghosts: [{ atMs: 0, value: 0.1, easing: "linear" }] } }])).toBe("invalid");
    expect(valid([{ ...keyed, keyframes: { amount: [{ atMs: 0, value: 3, easing: "linear" }] } }])).toBe("out_of_range");
  });

  it("keeps pace parameters still so a moving effect never jumps", () => {
    expect(keyedParams("particles")).not.toContain("speed");
    expect(keyedParams("particles")).toContain("size");
    expect(keyedParams("shake")).not.toContain("frequency");
    const paced = { ...newVfx("particles", "p", 1), keyframes: { speed: [{ atMs: 0, value: 1, easing: "linear" as const }] } };
    expect(valid([paced])).toBe("invalid");
  });
});

describe("vfx math is deterministic", () => {
  it("hashes the same inputs to the same value and spreads nearby inputs", () => {
    expect(hash32(1, 2, 3)).toBe(hash32(1, 2, 3));
    expect(hash32(1, 2, 3)).not.toBe(hash32(1, 2, 4));
    expect(hash32(0, 0, 0)).toBe(744_138_621);
    const values = Array.from({ length: 2000 }, (_, i) => hash01(9, 1, i));
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });

  it("makes smooth noise that meets the lattice values and stays in -1 to 1", () => {
    for (let t = -3; t < 3; t += 0.37) {
      const v = noise1(4, 1, t);
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
      expect(Math.abs(noise1(4, 1, t + 0.001) - v)).toBeLessThan(0.01);
    }
    expect(noise1(4, 1, 2)).toBeCloseTo(hash01(4, 1, 2) * 2 - 1);
  });

  it("refreshes grain at its rate", () => {
    const grain = { ...newVfx("grain", "g", 1), params: { rate: 24 } };
    expect(grainFrame(look(grain, 0))).toBe(0);
    expect(grainFrame(look(grain, 41))).toBe(0);
    expect(grainFrame(look(grain, 42))).toBe(1);
    expect(grainFrame(look(grain, 1000))).toBe(24);
  });

  it("bursts glitches by a seeded schedule that follows the frequency", () => {
    const quiet = { ...newVfx("glitch", "g", 5), params: { frequency: 0 } };
    expect(Array.from({ length: 60 }, (_, i) => glitchBurst(look(quiet, i * 50)).strength).every((s) => s === 0)).toBe(true);
    const wild = { ...newVfx("glitch", "g", 5), params: { frequency: 30 } };
    expect(Array.from({ length: 60 }, (_, i) => glitchBurst(look(wild, i * 50)).strength).every((s) => s > 0)).toBe(true);
    const some = newVfx("glitch", "g", 5);
    const run = (seed: number) => Array.from({ length: 120 }, (_, i) => glitchBurst(look({ ...some, seed }, i * 1000 / 12)).strength);
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
    expect(glitchBurst(look(some, 100)).slot).toBe(glitchBurst(look(some, 160)).slot);
  });

  it("shakes within its reach, smoothly, and not at all at amount 0", () => {
    const shake = { ...newVfx("shake", "s", 2), params: { amount: 1, rotation: 4, frequency: 6 } };
    const at = (ms: number) => shakeAt(look(shake, ms), 1080, 1920);
    for (let ms = 0; ms < 3000; ms += 33) {
      const offset = at(ms);
      expect(Math.abs(offset.dx)).toBeLessThanOrEqual(1080 * 0.06 + 1e-9);
      expect(Math.abs(offset.dy)).toBeLessThanOrEqual(1080 * 0.06 + 1e-9);
      expect(Math.abs(offset.rotation)).toBeLessThanOrEqual(4 + 1e-9);
      const next = at(ms + 1);
      expect(Math.abs(next.dx - offset.dx)).toBeLessThan(5);
    }
    expect(at(700)).toEqual(at(700));
    expect(shakeAt(look({ ...shake, params: { amount: 0, rotation: 0 } }, 700), 1080, 1920)).toEqual({ dx: 0, dy: 0, rotation: 0 });
  });

  it("zooms just enough to hide the frame edges while shaking", () => {
    const still = { ...newVfx("shake", "s", 2), params: { amount: 0, rotation: 0 } };
    expect(shakeCover(look(still, 0), 1080, 1920)).toBe(1);
    const strong = { ...newVfx("shake", "s", 2), params: { amount: 1, rotation: 5 } };
    const zoom = shakeCover(look(strong, 0), 1080, 1920);
    expect(zoom).toBeGreaterThan(1.1);
    expect(zoom).toBeLessThan(1.6);
  });

  it("moves light leaks with time and the seed, and keeps flare ghosts fixed per seed", () => {
    const leak = newVfx("lightLeak", "l", 3);
    expect(leakBlobs(look(leak, 0), 1080, 1920)).toEqual(leakBlobs(look(leak, 0), 1080, 1920));
    expect(leakBlobs(look(leak, 0), 1080, 1920)).not.toEqual(leakBlobs(look(leak, 2000), 1080, 1920));
    expect(leakBlobs(look({ ...leak, params: { speed: 0 } }, 0), 1080, 1920)).toEqual(leakBlobs(look({ ...leak, params: { speed: 0 } }, 5000), 1080, 1920));
    const flare = newVfx("lensFlare", "f", 4);
    expect(flareGhosts(look(flare, 0))).toEqual(flareGhosts(look(flare, 900)));
    expect(flareGhosts(look(flare, 0))).not.toEqual(flareGhosts(look({ ...flare, seed: 5 }, 0)));
    expect(flareFlicker(look({ ...flare, params: { flicker: 0 } }, 300))).toBe(1);
    const flicker = flareFlicker(look({ ...flare, params: { flicker: 1 } }, 300));
    expect(flicker).toBeGreaterThanOrEqual(0);
    expect(flicker).toBeLessThanOrEqual(1);
  });

  it("darkens the vignette toward the edges and not at the center", () => {
    const vignette = look(newVfx("vignette", "v", 1), 0);
    expect(vignetteWeight(vignette, 0.5, 0.5, 1920, 1080)).toBe(0);
    expect(vignetteWeight(vignette, 0.02, 0.02, 1920, 1080)).toBeGreaterThan(0.9);
    const middle = vignetteWeight(vignette, 0.2, 0.5, 1920, 1080);
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(vignetteWeight(vignette, 0.05, 0.5, 1920, 1080));
  });
});

describe("vfx in documents, playback and scenes", () => {
  function film(): VideoDocument {
    const d = emptyVideoDocument("landscape");
    const shot = { ...newMediaClip("video", "vid", 0, 4000), id: "shot", vfx: [newVfx("grain", "g", 1)] };
    const effect = { ...newEffectClip([newVfx("glitch", "x", 2), newVfx("shake", "s", 3)], 1000, 2000), id: "fx" };
    d.tracks = [
      { id: "v1", kind: "visual", clips: [shot] },
      { id: "v2", kind: "visual", clips: [effect] },
      { id: "v3", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Hi"), 0, 4000), id: "title" }] },
    ];
    d.durationMs = 4000;
    return d;
  }

  it("validates effect clips and clip effects, and refuses them where they do not belong", () => {
    expect(documentIssue("video", film())).toBeNull();
    const withAsset = film();
    withAsset.tracks[1].clips[0] = { ...withAsset.tracks[1].clips[0], assetId: "vid" };
    expect(documentIssue("video", withAsset)).toEqual({ field: "document.tracks", code: "invalid" });
    const keyed = film();
    keyed.tracks[1].clips[0] = { ...keyed.tracks[1].clips[0], keyframes: { opacity: [{ atMs: 0, value: 1, easing: "linear" }] } };
    expect(documentIssue("video", keyed)?.code).toBe("invalid");
    const moved = film();
    moved.tracks[1].clips[0] = { ...moved.tracks[1].clips[0], transform: { ...fullFrame(), x: 0.4 } };
    expect(documentIssue("video", moved)?.code).toBe("invalid");
    const sound = film();
    sound.tracks.push({ id: "a", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 1000), id: "song", vfx: [newVfx("grain", "q", 1)] }] });
    expect(documentIssue("video", sound)?.code).toBe("invalid");
    const raw = JSON.parse(JSON.stringify(film()));
    raw.tracks[0].clips[0].vfx[0].glow = 1;
    expect(documentIssue("video", raw)?.code).toBe("invalid");
  });

  it("plays an effect clip in its track order and shakes clips that carry a shake", () => {
    const plan = visualPlan(film(), 1500);
    expect(plan.map((item) => item.type)).toEqual(["video", "effect", "overlay"]);
    const effect = plan.find((item) => item.clipId === "fx")!;
    expect(effect.vfx?.map((look) => look.kind)).toEqual(["glitch", "shake"]);
    expect(effect.vfx?.[0].timeMs).toBe(500);
    const shaken = film();
    shaken.tracks[0].clips[0].vfx = [{ ...newVfx("shake", "s", 4), params: { amount: 1 } }];
    const shot = visualPlan(shaken, 700).find((item) => item.clipId === "shot")!;
    expect(shot.vfx).toBeUndefined();
    expect(shot.transform.x).not.toBe(0.5);
  });

  it("builds a full frame effect node that mattes skip over", () => {
    const scene = videoScene(film(), visualPlan(film(), 1500));
    const node = scene.nodes.find((entry) => entry.id === "fx")!;
    expect(node.source).toEqual({ kind: "effect" });
    expect(node.box).toEqual({ x: 960, y: 540, width: 1920, height: 1080, rotation: 0 });
    expect(scene.nodes.find((entry) => entry.id === "shot")?.vfx?.map((look) => look.kind)).toEqual(["grain"]);
  });

  it("continues the effect time across a split so the right piece picks up where the left stopped", () => {
    const split = splitClip(film(), "fx", 2200).document;
    const right = findClip(split, split.tracks[1].clips.find((clip) => clip.id !== "fx")!.id)!.clip;
    expect(right.vfx?.[0].offsetMs).toBe(1200);
    expect(visualPlan(split, 2500).find((item) => item.clipId === right.id)?.vfx?.[0].timeMs).toBe(1500);
    expect(documentIssue("video", split)).toBeNull();
  });
});

describe("the vfx contract shared with the server", () => {
  const fixture = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_vfx.json"), "utf8"));

  it("lists the same kinds, parameters, ranges, defaults, pace flags and colors", () => {
    const ours = Object.fromEntries(
      VFX_KINDS.map((kind) => [
        kind,
        {
          params: Object.fromEntries(vfxParams(kind).map((name) => {
            const spec = VFX_SPECS[kind].params[name]!;
            return [name, [spec.range[0], spec.range[1], spec.fallback, spec.keyed]];
          })),
          colors: Object.fromEntries(vfxColors(kind).map((name) => [name, VFX_SPECS[kind].colors[name]])),
        },
      ]),
    );
    expect(ours).toEqual(fixture.specs);
  });

  it("accepts the shared document", () => {
    expect(documentIssue("video", fixture.valid)).toBeNull();
  });
});
