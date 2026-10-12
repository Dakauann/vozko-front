"use client";

import { VFX_KINDS, type VfxKind } from "@/lib/studio/vfx";
import { effectSample, plainSample } from "@/lib/studio/vfx-samples";

import { sampleThumbnails, useSampleThumbnails, type Thumbnails } from "./sample-thumbnails";

export const PLAIN_PREVIEW = "plain";

export type EffectPreviewKey = VfxKind | typeof PLAIN_PREVIEW;

export type EffectThumbnails = Thumbnails<EffectPreviewKey>;

export const effectThumbnails = sampleThumbnails<EffectPreviewKey>(() => [{ key: PLAIN_PREVIEW, ...plainSample() }, ...VFX_KINDS.map((kind) => ({ key: kind, ...effectSample(kind) }))]);

export function useEffectThumbnails(): EffectThumbnails | null {
  return useSampleThumbnails(effectThumbnails);
}
