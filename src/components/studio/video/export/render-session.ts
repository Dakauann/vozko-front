"use client";

import type { CanvasSize } from "@/lib/studio/document";
import type { Renderer } from "@/lib/studio/render/renderer";

import { loadMediaFile } from "../../canvas/media-files";
import { DecodedVideos } from "../../media/decoded-videos";
import { openMediaWorker } from "../../media/media-worker";
import { gpuRenderingWanted } from "../../render/gpu-preference";
import { studioRenderSources } from "../../render/studio-sources";
import { failedExport, type BrowserExport } from "./export-result";
import { Wake } from "./frame-loop";

export interface RenderSession {
  canvas: HTMLCanvasElement;
  size: CanvasSize;
  videos: DecodedVideos;
  renderer: Renderer;
  wake: Wake;
}

export async function withRenderSession(size: CanvasSize, run: (session: RenderSession) => Promise<BrowserExport>): Promise<BrowserExport> {
  if (!gpuRenderingWanted()) return failedExport("renderer_off");
  const port = openMediaWorker();
  if (!port) return failedExport("undecodable");
  const wake = new Wake();
  const videos = new DecodedVideos(port, loadMediaFile, (assetId) => assetId, () => wake.notify());
  const canvas = window.document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  let renderer: Renderer | null = null;
  try {
    const { createPixiRenderer } = await import("../../render/pixi-renderer");
    renderer = await createPixiRenderer(canvas, { width: size.width, height: size.height, resolution: 1 }, studioRenderSources(videos), () => wake.notify());
    return await run({ canvas, size, videos, renderer, wake });
  } catch {
    return failedExport("failed");
  } finally {
    renderer?.destroy();
    videos.dispose();
  }
}
