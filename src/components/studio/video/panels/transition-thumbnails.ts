"use client";

import { EDGE_TRANSITION_KINDS, type EdgeTransitionKind } from "@/lib/studio/edge-transitions";
import { edgeSample, transitionSample } from "@/lib/studio/transition-samples";
import { TRANSITION_KINDS, type VisualTransitionKind } from "@/lib/studio/transitions";

import { sampleThumbnails, useSampleThumbnails, type Thumbnails } from "./sample-thumbnails";

export const cutThumbnails = sampleThumbnails(() => TRANSITION_KINDS.map((kind) => ({ key: kind, ...transitionSample(kind) })));

export const edgeThumbnails = sampleThumbnails(() => EDGE_TRANSITION_KINDS.map((kind) => ({ key: kind, ...edgeSample(kind) })));

export function useCutThumbnails(): Thumbnails<VisualTransitionKind> | null {
  return useSampleThumbnails(cutThumbnails);
}

export function useEdgeThumbnails(wanted: boolean): Thumbnails<EdgeTransitionKind> | null {
  return useSampleThumbnails(edgeThumbnails, wanted);
}
