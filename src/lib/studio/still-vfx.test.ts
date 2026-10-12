import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyArtboard, fullFrame, newImageLayer, newShapeLayer, type Artboard, type ImageDocument, type Layer } from "./document";
import { documentIssue } from "./validate";
import { STILL_VFX_KINDS, isStillKind, stillLook, stillLooks, stillParams, stillReach, stillVfxIssue } from "./still-vfx";
import { glitchBurst, flareFlicker, keyedParams, lookValue, newVfx, VFX_KINDS, type Vfx } from "./vfx";

describe("still effects", () => {
  it("offers the effects that make sense without time", () => {
    expect([...STILL_VFX_KINDS]).toEqual([
      "grain",
      "lightLeak",
      "vignette",
      "chromaticAberration",
      "glitch",
      "lensFlare",
      "glow",
      "mosaic",
      "posterize",
      "mirror",
      "offset",
      "directionalBlur",
      "zoomBlur",
      "spinBlur",
      "waveWarp",
      "ripple",
      "twirl",
      "bulge",
      "cornerPin",
      "fractalNoise",
      "gradientRamp",
      "fourColorGradient",
    ]);
    expect(STILL_VFX_KINDS.every((kind) => (VFX_KINDS as readonly string[]).includes(kind))).toBe(true);
    for (const moving of ["particles", "shake", "audioSpectrum", "audioWaveform", "posterizeTime", "echo"]) expect(isStillKind(moving)).toBe(false);
    expect(isStillKind("grain")).toBe(true);
    expect(stillParams("waveWarp")).toEqual(["amount", "angle", "length", "height", "phase"]);
    expect(stillParams("fractalNoise")).toEqual(["amount", "size", "complexity", "contrast", "brightness"]);
  });

  it("keeps only the values a still picture can show", () => {
    expect(stillParams("grain")).toEqual(["amount", "size", "chroma"]);
    expect(stillParams("lightLeak")).toEqual(["amount", "size", "x", "y"]);
    expect(stillParams("glitch")).toEqual(["amount", "size", "split", "scanlines"]);
    expect(stillParams("lensFlare")).toEqual(["amount", "size", "x", "y", "ghosts", "streak"]);
    expect(stillParams("vignette")).toEqual(keyedParams("vignette"));
    expect(stillParams("chromaticAberration")).toEqual(keyedParams("chromaticAberration"));
  });

  it("freezes the look at one seeded moment where a glitch always fires and a flare never flickers", () => {
    const glitch = stillLook({ ...newVfx("glitch", "g", 41), params: { amount: 0.8 } });
    expect(glitch.timeMs).toBe(0);
    expect(glitchBurst(glitch).strength).toBeGreaterThan(0);
    expect(lookValue(glitch, "amount")).toBe(0.8);
    const flare = stillLook(newVfx("lensFlare", "f", 3));
    expect(flareFlicker(flare)).toBe(1);
    expect(stillLook(newVfx("glitch", "g", 41))).toEqual(stillLook(newVfx("glitch", "g", 41)));
    expect(glitchBurst(stillLook(newVfx("glitch", "g", 41))).strength).not.toBe(glitchBurst(stillLook(newVfx("glitch", "g", 42))).strength);
  });

  it("draws the visible effects in list order", () => {
    const list: Vfx[] = [newVfx("grain", "a", 1), { ...newVfx("vignette", "b", 0), hidden: true }, newVfx("lightLeak", "c", 2)];
    expect(stillLooks(list).map((look) => look.id)).toEqual(["a", "c"]);
    expect(stillLooks(undefined)).toEqual([]);
  });

  it("reaches past the picture only as far as the colors split", () => {
    const frame = { width: 400, height: 300 };
    expect(stillReach([stillLook(newVfx("grain", "a", 1))], frame)).toBe(0);
    expect(stillReach([stillLook({ ...newVfx("chromaticAberration", "c", 0), params: { amount: 0.5 } }), stillLook({ ...newVfx("glitch", "g", 1), params: { split: 30 } })], frame)).toBe(30);
  });

  it("refuses effects that move or only exist in time", () => {
    expect(stillVfxIssue([newVfx("grain", "a", 1), newVfx("lensFlare", "b", 2)])).toBeNull();
    expect(stillVfxIssue([newVfx("particles", "a", 1)])).toBe("unknown");
    expect(stillVfxIssue([newVfx("shake", "a", 1)])).toBe("unknown");
    expect(stillVfxIssue([{ ...newVfx("grain", "a", 1), params: { rate: 12 } }])).toBe("invalid");
    expect(stillVfxIssue([{ ...newVfx("lensFlare", "a", 1), params: { flicker: 0.4 } }])).toBe("invalid");
    expect(stillVfxIssue([{ ...newVfx("grain", "a", 1), offsetMs: 10 }])).toBe("invalid");
    expect(stillVfxIssue([{ ...newVfx("grain", "a", 1), keyframes: { amount: [{ atMs: 0, value: 0.2, easing: "linear" }] } }])).toBe("invalid");
    expect(stillVfxIssue([{ ...newVfx("grain", "a", 1), params: { amount: 3 } }])).toBe("out_of_range");
    expect(stillVfxIssue([newVfx("grain", "a", 1), newVfx("vignette", "a", 1)])).toBe("invalid");
  });
});

function imageDoc(board: Partial<Artboard>, layers: Layer[]): ImageDocument {
  return { schema: "studio.image", version: 2, artboards: [{ ...emptyArtboard({ width: 400, height: 400 }, "#ffffff"), id: "a1", ...board, layers }] };
}

describe("still effects in image documents", () => {
  const photo: Layer = { ...newImageLayer("media-photo", fullFrame()), id: "photo" };

  it("accepts still effects on image layers and on the artboard", () => {
    const doc = imageDoc({ canvas: { width: 400, height: 400, background: "#ffffff", vfx: [newVfx("vignette", "v", 0)] } }, [{ ...photo, vfx: [newVfx("grain", "g", 3)] }]);
    expect(documentIssue("image", doc)).toBeNull();
  });

  it("refuses effects on layers that are not pictures, and moving effects anywhere", () => {
    const shape: Layer = { ...newShapeLayer("rect", fullFrame()), id: "box", vfx: [newVfx("grain", "g", 3)] };
    expect(documentIssue("image", imageDoc({}, [shape]))).not.toBeNull();
    expect(documentIssue("image", imageDoc({}, [{ ...photo, vfx: [newVfx("particles", "p", 3)] }]))).not.toBeNull();
    expect(documentIssue("image", imageDoc({ canvas: { width: 400, height: 400, background: "#ffffff", vfx: [newVfx("shake", "s", 1)] } }, []))).not.toBeNull();
    expect(documentIssue("image", imageDoc({}, [{ ...photo, vfx: [{ ...newVfx("grain", "g", 3), offsetMs: 40 }] }]))).not.toBeNull();
  });

  it("matches the still effect contract the server reads", () => {
    const fixture = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_still_vfx.json"), "utf8"));
    expect(Object.fromEntries(STILL_VFX_KINDS.map((kind) => [kind, stillParams(kind)]))).toEqual(fixture.stills);
    expect(documentIssue("image", fixture.valid)).toBeNull();
  });
});
