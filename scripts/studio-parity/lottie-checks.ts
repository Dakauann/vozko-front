import { DotLottie } from "@lottiefiles/dotlottie-web";

import { emptyVideoDocument, VIDEO_ASPECT_SIZES, type VideoDocument } from "@/lib/studio/document";
import { lottieClip } from "@/lib/studio/lottie/lottie-import";
import type { LottieAnimation } from "@/lib/studio/lottie/lottie-types";

import parity from "../../../vozko-back/domain/studio/testdata/lottie/parity.json";

import { LOTTIE_WASM_PATH } from "./lottie-wasm";

type Frames = (doc: VideoDocument, width: number, height: number, times: readonly number[]) => Promise<Uint8Array[]>;
type ExportedFrame = (doc: VideoDocument, atMs: number, width: number, height: number) => Promise<Uint8Array | null>;

const SIDE = VIDEO_ASPECT_SIZES.square.width;
const TIMES = [0, 500, 1000, 1500];
const TOLERANCE = 48;
const MAX_MISS = 0.02;
const EXPORT_TOLERANCE = 12;
const MAX_EXPORT_MISS = 0.002;
const MIN_INK = 0.02;
const RENDER_WAIT_MS = 3000;
const BLACK = "#000000";

function film(): VideoDocument {
  const imported = lottieClip(parity as unknown as LottieAnimation, { canvas: VIDEO_ASPECT_SIZES.square, atMs: 0, name: "Paridade" });
  if (!imported.ok) throw new Error(`the parity Lottie was refused: ${JSON.stringify(imported)}`);
  const doc = emptyVideoDocument("square", BLACK);
  return { ...doc, durationMs: imported.clip.durationMs, tracks: [{ id: "t-lottie", kind: "visual", clips: [imported.clip] }] };
}

function waitFor(player: DotLottie, event: "load" | "render"): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`the reference player did not ${event}`)), RENDER_WAIT_MS);
    player.addEventListener(event, () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function referenceFrames(step: number): Promise<Uint8Array[]> {
  DotLottie.setWasmUrl(LOTTIE_WASM_PATH);
  const canvas = document.createElement("canvas");
  canvas.width = SIDE;
  canvas.height = SIDE;
  const player = new DotLottie({ canvas, data: parity as Record<string, unknown>, autoplay: false, loop: false, backgroundColor: BLACK, renderConfig: { autoResize: false, devicePixelRatio: 1, freezeOnOffscreen: false } });
  await waitFor(player, "load");
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = SIDE;
  probe.canvas.height = SIDE;
  const frames: Uint8Array[] = [];
  for (const ms of TIMES) {
    const rendered = waitFor(player, "render");
    player.setFrame((ms * parity.fr) / 1000);
    await rendered.catch(() => undefined);
    probe.fillStyle = BLACK;
    probe.fillRect(0, 0, SIDE, SIDE);
    probe.drawImage(canvas, 0, 0, SIDE, SIDE);
    const data = probe.getImageData(0, 0, SIDE, SIDE).data;
    const out: number[] = [];
    for (let y = 0; y < SIDE; y += step) for (let x = 0; x < SIDE; x += step) out.push(data[(y * SIDE + x) * 4], data[(y * SIDE + x) * 4 + 1], data[(y * SIDE + x) * 4 + 2]);
    frames.push(new Uint8Array(out));
  }
  player.destroy();
  return frames;
}

function missShare(a: Uint8Array, b: Uint8Array, tolerance: number): number {
  let missed = 0;
  const samples = Math.min(a.length, b.length) / 3;
  for (let i = 0; i < samples * 3; i += 3) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > tolerance) missed += 1;
  return missed / Math.max(1, samples);
}

function ink(frame: Uint8Array): number {
  let lit = 0;
  for (let i = 0; i < frame.length; i += 3) if (frame[i] > 40 || frame[i + 1] > 40 || frame[i + 2] > 40) lit += 1;
  return lit / Math.max(1, frame.length / 3);
}

export async function lottieParity(frames: Frames, exportedFrame: ExportedFrame, step: number): Promise<Record<string, unknown>> {
  const doc = film();
  const ours = await frames(doc, SIDE, SIDE, TIMES);
  const reference = await referenceFrames(step);
  const misses = TIMES.map((_, i) => Number(missShare(ours[i], reference[i], TOLERANCE).toFixed(4)));
  const exported = await exportedFrame(doc, TIMES[2], SIDE, SIDE);
  const exportMiss = exported ? Number(missShare(exported, ours[2], EXPORT_TOLERANCE).toFixed(4)) : 1;
  const inks = ours.map((frame) => Number(ink(frame).toFixed(4)));
  return {
    times: TIMES,
    misses,
    worst: Math.max(...misses),
    exportMiss,
    inks,
    lottieOk: misses.every((share) => share <= MAX_MISS) && inks.every((share) => share >= MIN_INK),
    exportOk: exportMiss <= MAX_EXPORT_MISS,
  };
}
