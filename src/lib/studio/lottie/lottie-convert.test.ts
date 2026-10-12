import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { emptyVideoDocument, VIDEO_ASPECT_SIZES, type Clip, type VideoDocument } from "../document";
import { isValidPath } from "../vector-path";
import { parseDocument } from "../validate";
import { convertLottie, type LottieConversion } from "./lottie-convert";
import type { LottieAnimation } from "./lottie-types";

const FIXTURES = join(process.cwd(), "..", "vozko-back", "domain", "studio", "testdata", "lottie");
const CANVAS = VIDEO_ASPECT_SIZES.square;

function fixture(name: string): LottieAnimation {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as LottieAnimation;
}

function converted(name: string): Extract<LottieConversion, { ok: true }> {
  const result = convertLottie(fixture(name), { canvas: CANVAS, atMs: 0, name });
  if (!result.ok) throw new Error(JSON.stringify(result.gaps));
  return result;
}

function inner(result: Extract<LottieConversion, { ok: true }>): Clip[] {
  return result.clip.tracks.flatMap((track) => track.clips);
}

function filmOf(clip: Clip): VideoDocument {
  const doc = emptyVideoDocument("square");
  return { ...doc, durationMs: clip.startMs + clip.durationMs, tracks: [{ id: "t-lottie", kind: "visual", clips: [clip] }, ...doc.tracks] };
}

describe("converting a Lottie animation into ordinary clips", () => {
  it("turns still shapes into path overlays in one named group, the first item on top", () => {
    const result = converted("static-shapes");
    expect(result.clip).toMatchObject({ type: "group", name: "static-shapes", startMs: 0, durationMs: 1000, trimInMs: 0 });
    const clips = inner(result);
    expect(clips.map((clip) => clip.type)).toEqual(["overlay", "overlay"]);
    const [ring, box] = clips;
    expect(box.layer).toMatchObject({ shape: "path", path: "M1 0 L1 1 L0 1 L0 0 Z", fill: "#ff0000" });
    expect(box.transform).toMatchObject({ x: 0.5, y: 0.5, w: 0.4, h: 0.3, opacity: 1 });
    expect(ring.layer).toMatchObject({ stroke: "#0000ff", lineCap: "round", lineJoin: "round", miterLimit: 4 });
    expect(ring.layer?.strokeWidth).toBeCloseTo(21.6, 6);
    expect(ring.transform.w).toBeCloseTo(0.6, 9);
    expect(parseDocument("video", filmOf(result.clip)).ok).toBe(true);
  });

  it("keeps keyframes with their easing on a null and fades the shape parented to it", () => {
    const result = converted("keyframes");
    const clips = inner(result);
    const holder = clips.find((clip) => clip.type === "null")!;
    const ball = clips.find((clip) => clip.type === "overlay")!;
    expect(ball.parentId).toBe(holder.id);
    expect(holder.keyframes?.x).toEqual([
      { atMs: 0, value: 0.25, easing: "cubic-bezier(0.33,0,0.67,1)" },
      { atMs: 1000, value: 0.75, easing: "linear" },
    ]);
    expect(holder.keyframes?.y).toBeUndefined();
    expect(holder.transform.y).toBe(0.5);
    expect(holder.keyframes?.rotation?.map((key) => [key.atMs, key.value, key.easing])).toEqual([
      [0, 0, "hold"],
      [500, 45, "cubic-bezier(0.4,0,0.6,1)"],
      [1000, 90, "linear"],
    ]);
    expect(holder.keyframes?.scale?.map((key) => [key.atMs, key.value])).toEqual([
      [0, 0.5],
      [667, 1],
    ]);
    expect(ball.keyframes?.opacity?.map((key) => [key.atMs, key.value, key.easing])).toEqual([
      [0, 0, "linear"],
      [333, 1, "linear"],
    ]);
    expect(ball.transform).toMatchObject({ x: 0.5, y: 0.5, w: 0.2, h: 0.2 });
    expect(parseDocument("video", filmOf(result.clip)).ok).toBe(true);
  });

  it("maps trim paths to the line animation trim with eased keys", () => {
    const result = converted("trim");
    const [line] = inner(result);
    expect(line.line).toEqual({ trim: { start: 0, end: 0, offset: 90 } });
    expect(line.keyframes?.trimEnd).toEqual([
      { atMs: 0, value: 0, easing: "cubic-bezier(0.25,0.1,0.25,1)" },
      { atMs: 1000, value: 1, easing: "linear" },
    ]);
    expect(line.layer).toMatchObject({ stroke: "#ffffff", lineCap: "round", lineJoin: "miter" });
    expect(isValidPath(line.layer!.path!)).toBe(true);
    expect(parseDocument("video", filmOf(result.clip)).ok).toBe(true);
  });

  it("maps layer masks to clip masks in the clip's own box", () => {
    const result = converted("mask");
    const clips = inner(result);
    const window = clips.find((clip) => clip.name === "Janela")!;
    expect(window.masks).toEqual([expect.objectContaining({ shape: "path", mode: "add", x: 0.5, y: 0.5, w: 1, h: 1, path: "M0.5 0.1 L0.9 0.5 L0.5 0.9 L0.1 0.5 Z", opacity: 1, expansion: 0 })]);
    const hole = clips.find((clip) => clip.name === "Furo")!;
    expect(hole.masks?.[0]).toMatchObject({ mode: "subtract", invert: true, opacity: 0.5 });
    expect(parseDocument("video", filmOf(result.clip)).ok).toBe(true);
  });

  it("turns a precomposition into a nested group with its start offset, anchor, motion and opacity", () => {
    const result = converted("precomp");
    const [star] = inner(result);
    expect(star.type).toBe("group");
    expect(star).toMatchObject({ name: "Estrela", startMs: 333, trimInMs: 167 });
    expect(star.transform.opacity).toBe(0.5);
    expect(star.anchor).toBeUndefined();
    expect(star.keyframes?.y?.map((key) => [key.atMs, key.value])).toEqual([
      [167, 0.5],
      [1167, 0.3],
    ]);
    const polygon = star.tracks!.flatMap((track) => track.clips)[0];
    expect(polygon.layer).toMatchObject({ shape: "path", fill: "#1ab34d" });
    expect(parseDocument("video", filmOf(result.clip)).ok).toBe(true);
  });

  it("keeps parenting: a turning null carries the shape parented to it", () => {
    const result = converted("parenting");
    const clips = inner(result);
    const pivot = clips.find((clip) => clip.type === "null")!;
    expect(pivot).toMatchObject({ name: "Pivô", transform: { x: 0.5, y: 0.5 } });
    expect(pivot.keyframes?.rotation?.map((key) => key.value)).toEqual([0, 360]);
    const satellite = clips.find((clip) => clip.type === "overlay")!;
    expect(satellite.parentId).toBe(pivot.id);
    expect(satellite.transform.x).toBeCloseTo(0.75, 9);
    expect(satellite.transform.y).toBeCloseTo(0.5, 9);
    expect(parseDocument("video", filmOf(result.clip)).ok).toBe(true);
  });

  it("morphs an animated path with pinned first points", () => {
    const result = converted("morph");
    const [shape] = inner(result);
    const keys = shape.keyframes?.path ?? [];
    expect(keys.map((key) => [key.atMs, key.easing])).toEqual([
      [0, "cubic-bezier(0.4,0,0.2,1)"],
      [1000, "linear"],
    ]);
    expect(keys.every((key) => isValidPath(key.path) && key.firstVertex !== undefined)).toBe(true);
    expect(shape.layer?.path).toBe(keys[0].path);
    expect(parseDocument("video", filmOf(result.clip)).ok).toBe(true);
  });

  it("refuses with the full list of what cannot be converted", () => {
    const result = convertLottie(fixture("unsupported"), { canvas: CANVAS, atMs: 0, name: "unsupported" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.gaps).toEqual(
      expect.arrayContaining([
        { code: "expression", where: "Tremida" },
        { code: "effects", where: "Desfocada" },
        { code: "gradient", where: "Desfocada" },
        { code: "image", where: "Foto" },
        { code: "text", where: "Título" },
        { code: "trackMatte", where: "Recortada" },
      ]),
    );
  });

  it("places the animation at the asked time, centered and fitted inside a wider canvas", () => {
    const result = convertLottie(fixture("static-shapes"), { canvas: VIDEO_ASPECT_SIZES.landscape, atMs: 2500, name: "Logo" });
    if (!result.ok) throw new Error("refused");
    expect(result.clip).toMatchObject({ startMs: 2500, name: "Logo" });
    const box = result.clip.tracks.flatMap((track) => track.clips)[1];
    expect(box.transform.x).toBeCloseTo(0.5, 9);
    expect(box.transform.h).toBeCloseTo(0.3, 9);
    expect(box.transform.w).toBeCloseTo((80 * 1080) / 200 / 1920, 9);
  });
});
