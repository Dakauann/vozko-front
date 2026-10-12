import { emptyVideoDocument, type CanvasSize, type VideoDocument } from "../document";
import type { GroupClip } from "../group-scope";
import { parseDocument } from "../validate";
import { convertLottie, type LottieNote } from "./lottie-convert";
import { readLottieFile, type LottieFileFault } from "./lottie-file";
import type { LottieGap } from "./lottie-gaps";
import type { LottieAnimation } from "./lottie-types";

export interface LottieImportOptions {
  canvas: CanvasSize;
  atMs: number;
  name: string;
}

export type LottieImport = { ok: true; clip: GroupClip; notes: LottieNote[] } | { ok: false; fault: LottieFileFault } | { ok: false; gaps: LottieGap[] };

export function lottieClip(animation: LottieAnimation, options: LottieImportOptions): LottieImport {
  const converted = convertLottie(animation, options);
  if (!converted.ok) return converted;
  const doc = emptyVideoDocument("square");
  const film: VideoDocument = { ...doc, durationMs: converted.clip.startMs + converted.clip.durationMs, tracks: [{ id: "t-lottie", kind: "visual", clips: [converted.clip] }] };
  return parseDocument("video", film).ok ? converted : { ok: false, gaps: [{ code: "invalid", where: options.name }] };
}

export async function importLottieBytes(bytes: Uint8Array, options: LottieImportOptions): Promise<LottieImport> {
  const read = await readLottieFile(bytes);
  return read.ok ? lottieClip(read.animation, options) : read;
}

export function lottieName(fileName: string): string {
  return fileName.replace(/\.(json|lottie)$/i, "").trim() || fileName;
}
