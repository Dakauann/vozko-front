"use client";

import type { KeySample } from "@/lib/studio/chroma-detect";

import { assetKeyColor, urlKeyColor } from "../canvas/key-color";
import type { FrameExtractor } from "./timeline/frame-extractor";

const KEY_FRAME_HEIGHT = 128;

export async function sampleKeyColor(sample: KeySample, frames: Pick<FrameExtractor, "request">, signal: AbortSignal): Promise<string | null> {
  if (sample.still) return assetKeyColor(sample.assetId);
  const url = await frames.request(sample.assetId, sample.sourceMs, KEY_FRAME_HEIGHT, signal);
  return url && !signal.aborted ? urlKeyColor(url) : null;
}
