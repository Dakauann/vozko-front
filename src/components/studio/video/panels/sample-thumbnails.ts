"use client";

import { useEffect, useState } from "react";

import type { TrackLevels } from "@/lib/studio/behaviors";
import type { VideoDocument } from "@/lib/studio/document";
import { visualPlan } from "@/lib/studio/playback";
import { videoScene } from "@/lib/studio/scene/video-scene";
import { EFFECT_SAMPLE_SIZE } from "@/lib/studio/vfx-samples";

import { gpuRenderingWanted } from "../../render/gpu-preference";
import { createPixiRenderer } from "../../render/pixi-renderer";
import { studioRenderSources } from "../../render/studio-sources";
import { drawWhenReady, Wake } from "../export/frame-loop";

const SAMPLE_STALL_MS = 8000;
const NO_VIDEOS = { sync: () => [], ready: () => true };

interface ThumbnailSample<K> {
  key: K;
  doc: VideoDocument;
  atMs: number;
  levels?: TrackLevels;
}

export type Thumbnails<K> = ReadonlyMap<K, string>;

async function renderSampleThumbnails<K>(samples: readonly ThumbnailSample<K>[]): Promise<Thumbnails<K>> {
  const { width, height } = EFFECT_SAMPLE_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const copy = document.createElement("canvas").getContext("2d");
  if (!copy) return new Map();
  copy.canvas.width = width;
  copy.canvas.height = height;
  const wake = new Wake();
  const renderer = await createPixiRenderer(canvas, { width, height, resolution: 1 }, studioRenderSources(null), () => wake.notify());
  const thumbnails = new Map<K, string>();
  try {
    for (const { key, doc, atMs, levels } of samples) {
      const outcome = await drawWhenReady(videoScene(doc, visualPlan(doc, atMs, undefined, levels)), { videos: NO_VIDEOS, renderer, wake, stallMs: SAMPLE_STALL_MS, viewWidth: width });
      if (outcome !== "complete") continue;
      copy.clearRect(0, 0, width, height);
      copy.drawImage(canvas, 0, 0);
      thumbnails.set(key, copy.canvas.toDataURL("image/png"));
    }
  } finally {
    renderer.destroy();
  }
  return thumbnails;
}

export function sampleThumbnails<K>(build: () => readonly ThumbnailSample<K>[]): () => Promise<Thumbnails<K>> {
  let rendered: Promise<Thumbnails<K>> | null = null;
  return () => {
    rendered ??= renderSampleThumbnails(build()).catch(() => new Map<K, string>());
    return rendered;
  };
}

export function useSampleThumbnails<K>(load: () => Promise<Thumbnails<K>>, wanted: boolean = true): Thumbnails<K> | null {
  const [thumbnails, setThumbnails] = useState<Thumbnails<K> | null>(null);
  useEffect(() => {
    if (!wanted || !gpuRenderingWanted()) return;
    let live = true;
    void load().then((found) => {
      if (live) setThumbnails(found);
    });
    return () => {
      live = false;
    };
  }, [load, wanted]);
  return thumbnails;
}
