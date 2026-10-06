import { isActionError, type ActionResult } from "@/app/actions/action-result";
import type { MediaGenerationJob } from "@/lib/media-generation/types";

import { videoCanvasSize, type Layer, type VideoDocument } from "./document";

export const TOO_MANY_JOBS = "too_many_jobs";
export const NOT_RASTERIZED = "not_rasterized";

export interface RasterTarget {
  clipId: string;
  layer: Layer;
  widthPx: number;
  heightPx: number;
  fontBasePx: number;
  key: string;
}

export function rasterKey(layer: Layer, widthPx: number, heightPx: number, fontBasePx: number): string {
  return JSON.stringify([{ ...layer, id: "" }, widthPx, heightPx, fontBasePx]);
}

export function rasterTargets(doc: VideoDocument): RasterTarget[] {
  const canvas = videoCanvasSize(doc);
  const targets: RasterTarget[] = [];
  for (const track of doc.tracks) {
    if (track.kind !== "visual" || track.hidden) continue;
    for (const clip of track.clips) {
      if (clip.type !== "overlay" || !clip.layer || clip.disabled) continue;
      const widthPx = Math.max(1, Math.round(clip.transform.w * canvas.width));
      const heightPx = Math.max(1, Math.round(clip.transform.h * canvas.height));
      targets.push({ clipId: clip.id, layer: clip.layer, widthPx, heightPx, fontBasePx: canvas.height, key: rasterKey(clip.layer, widthPx, heightPx, canvas.height) });
    }
  }
  return targets;
}

export type ExportPhase = { phase: "saving" } | { phase: "rasterizing"; done: number; total: number } | { phase: "submitting" };

export type ExportFailureCode = "empty" | "unsaved" | "raster_failed" | "upload_failed" | typeof TOO_MANY_JOBS | typeof NOT_RASTERIZED | "invalid" | "request_failed" | string;

export type ExportStart =
  | { status: "started"; job: MediaGenerationJob; document: VideoDocument }
  | { status: "conflict" }
  | { status: "failed"; code: ExportFailureCode; message?: string };

export interface ExportDeps {
  flush: () => Promise<void>;
  committed: () => { version: number | null; settled: boolean };
  document: () => VideoDocument;
  rasterize: (target: RasterTarget) => Promise<Blob>;
  upload: (blob: Blob, target: RasterTarget) => Promise<ActionResult<{ mediaId: string }>>;
  requestExport: (version: number, rasters: Record<string, string>) => Promise<ActionResult<MediaGenerationJob>>;
  cache: Map<string, string>;
  onPhase?: (phase: ExportPhase) => void;
}

function exportFailure(status: number | undefined, code: string | undefined, message: string): ExportStart {
  if (status === 409) return { status: "conflict" };
  if (status === 429) return { status: "failed", code: TOO_MANY_JOBS, message };
  if (code === NOT_RASTERIZED) return { status: "failed", code: NOT_RASTERIZED, message };
  if (status === 422) return { status: "failed", code: code === "invalid_request" ? "invalid" : (code ?? "invalid"), message };
  return { status: "failed", code: code ?? "request_failed", message };
}

export async function startVideoExport(deps: ExportDeps): Promise<ExportStart> {
  deps.onPhase?.({ phase: "saving" });
  await deps.flush();
  const { version, settled } = deps.committed();
  if (!settled || version === null) return { status: "failed", code: "unsaved" };
  const document = deps.document();
  if (document.durationMs <= 0) return { status: "failed", code: "empty" };
  const targets = rasterTargets(document);
  const rasters: Record<string, string> = {};
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    deps.onPhase?.({ phase: "rasterizing", done: i, total: targets.length });
    const cached = deps.cache.get(target.key);
    if (cached) {
      rasters[target.clipId] = cached;
      continue;
    }
    let blob: Blob;
    try {
      blob = await deps.rasterize(target);
    } catch (error) {
      return { status: "failed", code: "raster_failed", message: error instanceof Error ? error.message : undefined };
    }
    const uploaded = await deps.upload(blob, target);
    if (isActionError(uploaded)) return { status: "failed", code: "upload_failed", message: uploaded.error };
    deps.cache.set(target.key, uploaded.data.mediaId);
    rasters[target.clipId] = uploaded.data.mediaId;
  }
  deps.onPhase?.({ phase: "submitting" });
  const result = await deps.requestExport(version, rasters);
  if (isActionError(result)) {
    if (result.code === NOT_RASTERIZED) for (const target of targets) deps.cache.delete(target.key);
    return exportFailure(result.status, result.code, result.error);
  }
  return { status: "started", job: result.data, document };
}

export function isExportOutdated(rendered: VideoDocument, current: VideoDocument): boolean {
  return rendered !== current;
}
