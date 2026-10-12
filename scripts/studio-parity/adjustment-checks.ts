import { cameraSourcePoint, type ClipCamera } from "@/lib/studio/clip-camera";
import { curvePresetPoints, curvesLut, curvesPixel, type ColorCurves } from "@/lib/studio/color-curves";
import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "@/lib/studio/document";
import { newMask } from "@/lib/studio/masks";
import { newEffectClip } from "@/lib/studio/vfx";

type Report = Record<string, unknown>;
type Frames = (doc: VideoDocument, width: number, height: number, times?: readonly number[]) => Promise<Uint8Array[]>;
type Rgb = readonly [number, number, number];

const SIZE = 1080;
const TOLERANCE = 3;
const EDGE_MARGIN = 0.03;
const CURVES: ColorCurves = { master: curvePresetPoints("contrast"), red: [{ x: 0, y: 0.15 }, { x: 1, y: 1 }] };
const CAMERA: ClipCamera = { panX: 0.08, panY: -0.06, zoom: 1.8, rotation: 25 };
const BACKGROUND: Rgb = [16, 16, 16];
const QUADRANTS: readonly Rgb[] = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 255],
];

function at(frame: Uint8Array, step: number, x: number, y: number): Rgb {
  const i = (Math.floor(y / step) * Math.ceil(SIZE / step) + Math.floor(x / step)) * 3;
  return [frame[i], frame[i + 1], frame[i + 2]];
}

function near(got: readonly number[], want: readonly number[], tolerance: number): boolean {
  return got.every((v, c) => Math.abs(v - want[c]) <= tolerance);
}

function film(asset: string, effect: Clip): VideoDocument {
  const doc = emptyVideoDocument("square", "#101010");
  doc.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", asset, 0, 200), id: "picture", fit: "cover" }] },
    { id: "v2", kind: "visual", clips: [{ ...effect, id: "adjust" }] },
  ];
  doc.durationMs = 200;
  return doc;
}

function byte(rgb: readonly number[]): number[] {
  return rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
}

export async function maskedCurvesParity(frames: Frames, step: number): Promise<Report> {
  const plain = (await frames(film("swatch.png", newEffectClip([], 0, 200)), SIZE, SIZE, [0]))[0];
  const base = at(plain, step, SIZE / 2, SIZE / 2);
  const want = byte(curvesPixel(base.map((v) => v / 255), curvesLut(CURVES)));
  const masked = { ...newEffectClip([], 0, 200), color: { curves: CURVES }, masks: [{ ...newMask("ellipse", "focus"), w: 0.5, h: 0.5 }] };
  const shown = (await frames(film("swatch.png", masked), SIZE, SIZE, [0]))[0];
  const inside = [at(shown, step, SIZE / 2, SIZE / 2), at(shown, step, SIZE * 0.4, SIZE * 0.55)];
  const outside = [at(shown, step, 8, 8), at(shown, step, SIZE - 12, SIZE / 2), at(shown, step, SIZE / 2, SIZE - 12)];
  return {
    base: base.join(","),
    want: want.join(","),
    inside: inside.map((rgb) => rgb.join(",")).join(" "),
    outside: outside.map((rgb) => rgb.join(",")).join(" "),
    maskedCurvesOk: inside.every((rgb) => near(rgb, want, TOLERANCE)) && outside.every((rgb) => near(rgb, base, TOLERANCE)) && !near(want, base, TOLERANCE),
  };
}

function quadrantOf(u: number, v: number): Rgb | null {
  if (u < 0 || u > 1 || v < 0 || v > 1) return BACKGROUND;
  if (Math.abs(u - 0.5) < EDGE_MARGIN || Math.abs(v - 0.5) < EDGE_MARGIN || u < EDGE_MARGIN || v < EDGE_MARGIN || u > 1 - EDGE_MARGIN || v > 1 - EDGE_MARGIN) return null;
  return QUADRANTS[(v < 0.5 ? 0 : 2) + (u < 0.5 ? 0 : 1)];
}

export async function cameraParity(frames: Frames, step: number): Promise<Report> {
  const camera = { ...newEffectClip([], 0, 200), camera: CAMERA };
  const shown = (await frames(film("quad.png", camera), SIZE, SIZE, [0]))[0];
  const canvas = { width: SIZE, height: SIZE };
  let checked = 0;
  const wrong: string[] = [];
  for (let y = 0; y < SIZE; y += step) {
    for (let x = 0; x < SIZE; x += step) {
      const source = cameraSourcePoint(CAMERA, canvas, (x + 0.5) / SIZE, (y + 0.5) / SIZE);
      const want = quadrantOf(source.x, source.y);
      if (!want) continue;
      checked += 1;
      const got = at(shown, step, x, y);
      if (!near(got, want, TOLERANCE)) wrong.push(`${x},${y}:${got.join("/")}~${want.join("/")}`);
    }
  }
  const zoomed = (await frames(film("quad.png", { ...newEffectClip([], 0, 200), camera: { panX: 0.25, panY: 0.25, zoom: 2, rotation: 0 } }), SIZE, SIZE, [0]))[0];
  const corner = [at(zoomed, step, 8, 8), at(zoomed, step, SIZE - 12, SIZE - 12)];
  return {
    checked,
    wrong: wrong.length,
    firstWrong: wrong.slice(0, 6).join(" "),
    zoomedCorners: corner.map((rgb) => rgb.join(",")).join(" "),
    cameraOk: checked > 1000 && wrong.length === 0 && corner.every((rgb) => near(rgb, QUADRANTS[3], TOLERANCE)),
  };
}
