import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { applyAnimation, captureAnimation, presetAnimationIssue, presetSummary, type PresetAnimation } from "./animation-presets";
import { emptyVideoDocument, newMediaClip, newNullClip, newOverlayClip, newTextLayer, type Clip, type VideoDocument } from "./document";
import { findClip } from "./timeline";
import { documentIssue } from "./validate";

const DOMAIN = resolve(__dirname, "../../../../vozko-back/domain/studio");

function read(path: string): unknown {
  return JSON.parse(readFileSync(resolve(DOMAIN, path), "utf8"));
}

function film(clips: Clip[]): VideoDocument {
  const doc = emptyVideoDocument("story");
  doc.tracks = [
    { id: "v1", kind: "visual", clips },
    { id: "a1", kind: "audio", clips: [] },
  ];
  doc.durationMs = 20_000;
  return doc;
}

function photo(id: string, startMs: number, durationMs: number, x = 0.3): Clip {
  return { ...newMediaClip("image", `m-${id}`, startMs, durationMs), id, transform: { x, y: 0.4, w: 0.4, h: 0.3, rotation: 10, opacity: 1 } };
}

describe("animation presets", () => {
  describe("shared fixture", () => {
    const fixture = read("testdata/editor_animation_presets.json") as { valid: { name: string; animation: unknown }[]; invalid: { reason: string; code: string; animation: unknown }[] };

    it.each(fixture.valid.map((entry) => [entry.name, entry.animation]))("accepts %s like the backend", (_name, animation) => {
      expect(presetAnimationIssue(animation)).toBeNull();
    });

    it.each(fixture.invalid.map((entry) => [entry.reason, entry.code, entry.animation]))("refuses %s like the backend", (_reason, code, animation) => {
      expect(presetAnimationIssue(animation)).toBe(code);
    });
  });

  it("validates every built-in preset", () => {
    const { presets } = read("builtin_presets.json") as { presets: { id: string; animation: unknown; names: Record<string, string> }[] };
    expect(presets.length).toBeGreaterThan(0);
    for (const preset of presets) {
      expect(presetAnimationIssue(preset.animation)).toBeNull();
      expect(Object.keys(preset.names).sort()).toEqual(["de", "en", "es", "pt"]);
    }
  });

  it("captures keys relative to the clip box and applies them to another clip", () => {
    const source: Clip = {
      ...photo("source", 0, 2000),
      keyframes: {
        x: [
          { atMs: 0, value: 0.1, easing: "easeOut" },
          { atMs: 1000, value: 0.3, easing: "linear" },
        ],
        opacity: [
          { atMs: 0, value: 0, easing: "linear" },
          { atMs: 500, value: 1, easing: "linear" },
        ],
      },
      behaviors: [{ id: "shake", kind: "wiggle", property: "rotation", frequency: 3, amount: 4, seed: 7 }],
      motionBlur: true,
    };
    const captured = captureAnimation(source);
    if (!captured.ok) throw new Error(captured.reason);
    expect(captured.animation.keyframes?.x?.map((key) => Number(key.value.toFixed(3)))).toEqual([-0.2, 0]);
    expect(presetAnimationIssue(captured.animation)).toBeNull();
    expect(presetSummary(captured.animation)).toMatchObject({ keys: ["opacity", "x"], behaviors: ["wiggle"], motion_blur: true });
    const doc = film([source, photo("target", 3000, 4000, 0.7)]);
    const applied = applyAnimation(doc, ["target"], captured.animation, "stretch");
    if (!applied.ok) throw new Error(applied.reason);
    const target = findClip(applied.document, "target")!.clip;
    expect(target.keyframes?.x?.map((key) => [key.atMs, Number(key.value.toFixed(3))])).toEqual([
      [0, 0.5],
      [2000, 0.7],
    ]);
    expect(target.behaviors?.[0]).toMatchObject({ kind: "wiggle", property: "rotation" });
    expect(target.behaviors?.[0].id).not.toBe("shake");
    expect(target.motionBlur).toBe(true);
    expect(documentIssue("video", applied.document)).toBeNull();
  });

  it("retimes by stretching, by keeping the edges or by keeping the time", () => {
    const animation: PresetAnimation = {
      scope: "visual",
      durationMs: 2000,
      keyframes: {
        opacity: [
          { atMs: 0, value: 0, easing: "linear" },
          { atMs: 400, value: 1, easing: "linear" },
          { atMs: 1600, value: 1, easing: "linear" },
          { atMs: 2000, value: 0, easing: "linear" },
        ],
      },
    };
    const doc = film([photo("long", 0, 8000)]);
    const times = (timing: "stretch" | "edges" | "keep") => {
      const result = applyAnimation(doc, ["long"], animation, timing);
      if (!result.ok) throw new Error(result.reason);
      return findClip(result.document, "long")!.clip.keyframes!.opacity!.map((key) => key.atMs);
    };
    expect(times("stretch")).toEqual([0, 1600, 6400, 8000]);
    expect(times("edges")).toEqual([0, 400, 7600, 8000]);
    expect(times("keep")).toEqual([0, 400, 1600, 2000]);
  });

  it("applies text parts only to text clips and reports what a clip cannot take", () => {
    const title: Clip = { ...newOverlayClip(newTextLayer("Oferta"), 0, 3000), id: "title" };
    const rig: Clip = { ...newNullClip(3000, 2000), id: "rig" };
    const animation: PresetAnimation = {
      scope: "text",
      durationMs: 3000,
      textIn: { unit: "word", style: "rise", durationMs: 400, staggerMs: 90, easing: "easeOut" },
      keyframes: { opacity: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 300, value: 1, easing: "linear" }], scale: [{ atMs: 0, value: 0.8, easing: "easeOut" }, { atMs: 300, value: 1, easing: "linear" }] },
    };
    const result = applyAnimation(film([title, rig]), ["title", "rig"], animation, "stretch");
    if (!result.ok) throw new Error(`${result.reason} ${result.code}`);
    expect(findClip(result.document, "title")!.clip.textIn?.style).toBe("rise");
    expect(findClip(result.document, "rig")!.clip.textIn).toBeUndefined();
    expect(findClip(result.document, "rig")!.clip.keyframes?.scale).toBeDefined();
    expect(result.skipped.rig).toEqual(expect.arrayContaining(["textIn", "keys:opacity,blur"]));
    expect(documentIssue("video", result.document)).toBeNull();
  });

  it("refuses a clip whose box the keys would push out of range and nothing to capture", () => {
    const far: PresetAnimation = { scope: "visual", durationMs: 1000, keyframes: { x: [{ atMs: 0, value: 1.4, easing: "linear" }, { atMs: 500, value: 0, easing: "linear" }] } };
    const result = applyAnimation(film([photo("edge", 0, 1000, 0.9)]), ["edge"], far);
    expect(result).toMatchObject({ ok: false, reason: "invalid", clipId: "edge" });
    expect(captureAnimation(photo("plain", 0, 1000))).toEqual({ ok: false, reason: "nothing" });
    expect(captureAnimation({ ...newMediaClip("audio", "song", 0, 1000), id: "song" })).toEqual({ ok: false, reason: "notVisual" });
  });
});
