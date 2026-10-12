import { sourceAt } from "@/lib/studio/clip-time";
import { gradePixel, type ColorGrade } from "@/lib/studio/color-grade";
import { curvePresetPoints, curvesLut, curvesPixel, type ColorCurves } from "@/lib/studio/color-curves";
import { lutAtlas, lutMixPixel, parseCube } from "@/lib/studio/cube-lut";
import { emptyVideoDocument, newMediaClip, videoCanvasSize, type Clip, type VideoDocument } from "@/lib/studio/document";
import { exportFrameMs, frameTimes } from "@/lib/studio/export-encoding";
import { huePixel, hueUniforms, type HueSecondary } from "@/lib/studio/hue-secondary";
import { FRAME_EPSILON_SEC } from "@/lib/studio/media/frame-stream";

import { LOOK_CUBE, LOOK_FILE } from "./lut-fixture";

type Report = Record<string, unknown>;
type Frames = (doc: VideoDocument, width: number, height: number, times?: readonly number[]) => Promise<Uint8Array[]>;
type Stripes = (doc: VideoDocument, width: number, height: number) => Promise<number[]>;

const SIZE = 256;
const FPS = 30;
const TOLERANCE = 2;
const CHAIN_TOLERANCE = 3;
const MIX_TOLERANCE = 18;
const CURVES: ColorCurves = { master: curvePresetPoints("contrast"), blue: [{ x: 0, y: 0.2 }, { x: 1, y: 0.8 }] };
const HSL: HueSecondary = { hue: 200, width: 40, softness: 20, desaturate: 100 };
const LUT_INTENSITY = 0.8;
const GRADE: ColorGrade = { exposure: 0.4, contrast: 20, saturation: 10 };

function at(frame: Uint8Array, width: number, step: number, x: number, y: number): number[] {
  const i = (Math.floor(y / step) * Math.ceil(width / step) + Math.floor(x / step)) * 3;
  return [frame[i], frame[i + 1], frame[i + 2]];
}

function byte(rgb: readonly number[]): number[] {
  return rgb.slice(0, 3).map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
}

function unit(rgb: readonly number[]): number[] {
  return rgb.map((v) => v / 255);
}

function near(got: readonly number[], want: readonly number[], tolerance: number): boolean {
  return got.every((v, c) => Math.abs(v - want[c]) <= tolerance);
}

function swatchFilm(color: ColorGrade): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "swatch.png", 0, 200), id: "swatch", fit: "cover", color }] }];
  doc.durationMs = 200;
  return doc;
}

async function swatchPixel(frames: Frames, step: number, color: ColorGrade): Promise<number[]> {
  const rendered = await frames(swatchFilm(color), SIZE, SIZE, [0]);
  return at(rendered[0], SIZE, step, SIZE / 2, SIZE / 2);
}

function lookAtlas() {
  const parsed = parseCube(LOOK_CUBE);
  if (!parsed.ok) throw new Error(`the parity LUT does not parse: ${parsed.fault}`);
  return lutAtlas(parsed.lut);
}

export async function colorFinishParity(frames: Frames, step: number): Promise<Report> {
  const atlas = lookAtlas();
  const base = unit(await swatchPixel(frames, step, {}));
  const curvesWant = byte(curvesPixel(base, curvesLut(CURVES)));
  const curvesGot = await swatchPixel(frames, step, { curves: CURVES });
  const lutWant = byte(lutMixPixel(base, atlas, LUT_INTENSITY));
  const lutGot = await swatchPixel(frames, step, { lut: { assetId: LOOK_FILE, intensity: LUT_INTENSITY } });
  const hslWant = byte(huePixel(base, hueUniforms(HSL)));
  const hslGot = await swatchPixel(frames, step, { hsl: HSL });
  const graded = byte(gradePixel(base, GRADE));
  const looked = byte(lutMixPixel(unit(graded), atlas, LUT_INTENSITY));
  const shaped = byte(curvesPixel(unit(looked), curvesLut(CURVES)));
  const chainWant = byte(huePixel(unit(shaped), hueUniforms(HSL)));
  const chainGot = await swatchPixel(frames, step, { ...GRADE, curves: CURVES, hsl: HSL, lut: { assetId: LOOK_FILE, intensity: LUT_INTENSITY } });
  return {
    base: byte(base).join(","),
    curves: `${curvesGot.join(",")} want ${curvesWant.join(",")}`,
    lut: `${lutGot.join(",")} want ${lutWant.join(",")}`,
    hsl: `${hslGot.join(",")} want ${hslWant.join(",")}`,
    chain: `${chainGot.join(",")} want ${chainWant.join(",")}`,
    curvesOk: near(curvesGot, curvesWant, TOLERANCE),
    lutOk: near(lutGot, lutWant, TOLERANCE),
    hslOk: near(hslGot, hslWant, TOLERANCE),
    chainOk: near(chainGot, chainWant, CHAIN_TOLERANCE),
  };
}

function curvedClip(): Clip {
  return {
    ...newMediaClip("video", "proxy.mp4", 0, 1500),
    id: "remap",
    keyframes: {
      speed: [
        { atMs: 0, value: 1, easing: "easeInOut" },
        { atMs: 700, value: 0.4, easing: "easeInOut" },
        { atMs: 1500, value: 2, easing: "linear" },
      ],
    },
  };
}

function film(clip: Clip): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  doc.tracks = [{ id: "v1", kind: "visual", clips: [clip] }];
  doc.durationMs = clip.durationMs;
  return doc;
}

function expectedFrame(ms: number): number {
  return Math.floor((ms / 1000 + FRAME_EPSILON_SEC) * FPS);
}

export async function remapParity(stripes: Stripes, frames: Frames, step: number): Promise<Report> {
  const clip = curvedClip();
  const doc = film(clip);
  const size = videoCanvasSize(doc);
  const shown = await stripes(doc, size.width, size.height);
  const misses = shown.flatMap((got, i) => {
    const source = sourceAt(clip, exportFrameMs(i));
    return got === expectedFrame(source) ? [] : [`${i}:${got}/${expectedFrame(source)}@${source.toFixed(2)}`];
  });
  const wrong = misses.length;
  const slow: Clip = { ...newMediaClip("video", "proxy.mp4", 0, 600), id: "slow", speed: 0.25, frameMix: true };
  const slowDoc = film(slow);
  const times = frameTimes(slowDoc.durationMs);
  const mixed = await frames(slowDoc, size.width, size.height, times);
  let blended = 0;
  let mixWrong = 0;
  let worst = 0;
  mixed.forEach((frame, i) => {
    const seconds = sourceAt(slow, times[i]) / 1000;
    const index = expectedFrame(seconds * 1000);
    const weight = Math.max(0, seconds * FPS - index);
    const bit = index % 2;
    const want = 255 * (weight > FRAME_EPSILON_SEC ? (1 - weight) * bit + weight * (1 - bit) : bit);
    const got = at(frame, size.width, step, size.width / 16, size.height / 2)[0];
    if (weight > FRAME_EPSILON_SEC) blended += 1;
    worst = Math.max(worst, Math.abs(got - want));
    if (Math.abs(got - want) > MIX_TOLERANCE) mixWrong += 1;
  });
  return { frames: shown.length, wrong, misses: misses.slice(0, 12).join(" "), mixFrames: mixed.length, blended, mixWrong, mixWorst: Math.round(worst), remapOk: shown.length > 0 && wrong === 0, frameMixOk: blended > 0 && mixWrong === 0 };
}
