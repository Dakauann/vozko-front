"use client";

import type { BoxTrackRequest } from "@/lib/studio/point-track";
import type { TrackOutcome } from "@/lib/studio/tracking/track-outcome";

import { loadMediaFile, type LoadedMediaFile } from "../canvas/media-files";
import type { MediaPort } from "./media-protocol";
import { openMediaWorker } from "./media-worker";

export interface TrackWatch {
  onProgress?: (done: number) => void;
  signal?: AbortSignal;
}

let asked = 0;

export function trackPoint(blob: Blob, request: BoxTrackRequest, watch: TrackWatch, open: () => MediaPort | null = openMediaWorker): Promise<TrackOutcome> {
  if (watch.signal?.aborted) return Promise.resolve({ kind: "cancelled" });
  const port = open();
  if (!port) return Promise.resolve({ kind: "unsupported" });
  asked += 1;
  const id = `track-${asked}`;
  return new Promise<TrackOutcome>((resolve) => {
    let settled = false;
    const finish = (outcome: TrackOutcome) => {
      if (settled) return;
      settled = true;
      watch.signal?.removeEventListener("abort", abort);
      port.close();
      resolve(outcome);
    };
    const abort = () => {
      port.send({ kind: "track-cancel", id });
      finish({ kind: "cancelled" });
    };
    watch.signal?.addEventListener("abort", abort);
    port.listen(
      (event) => {
        if (event.kind === "track-progress" && event.id === id) watch.onProgress?.(event.done);
        if (event.kind === "track-done" && event.id === id) finish(event.outcome);
      },
      () => finish({ kind: "failed" }),
    );
    port.send({ kind: "track", id, blob, request });
  });
}

export async function trackAssetPoint(assetId: string, request: BoxTrackRequest, watch: TrackWatch, load: (assetId: string) => Promise<LoadedMediaFile | null> = loadMediaFile): Promise<TrackOutcome> {
  const file = await load(assetId);
  if (watch.signal?.aborted) return { kind: "cancelled" };
  if (!file || !file.contentType.startsWith("video/")) return { kind: "undecodable" };
  return trackPoint(file.blob, request, watch);
}

export async function trackWithin(assetId: string, request: BoxTrackRequest, budgetMs: number, signal: AbortSignal): Promise<TrackOutcome> {
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop);
  let slow = false;
  const timer = setTimeout(() => {
    slow = true;
    controller.abort();
  }, Math.max(0, budgetMs));
  try {
    const outcome = await trackAssetPoint(assetId, request, { signal: controller.signal });
    return slow && outcome.kind === "cancelled" ? { kind: "slow" } : outcome;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
  }
}
