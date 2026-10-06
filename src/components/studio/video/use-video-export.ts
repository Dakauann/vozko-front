"use client";

import { useCallback, useRef, useState } from "react";

import { exportStudioVideoAction } from "@/app/actions/studio";
import { rasterizeLayer, uploadRaster } from "@/components/studio/canvas/rasterize";
import { useMediaGeneration, type MediaGenerationResult } from "@/hooks/use-media-generation";
import type { VideoDocument } from "@/lib/studio/document";
import { isExportOutdated, startVideoExport, type ExportPhase } from "@/lib/studio/export";

import { useEditorState, useVideoEditor } from "./editor-context";

export type VideoExportState =
  | { status: "idle" }
  | { status: "preparing"; phase: ExportPhase }
  | { status: "queued" }
  | { status: "rendering" }
  | { status: "finalizing" }
  | { status: "done"; result: MediaGenerationResult; outdated: boolean }
  | { status: "failed"; code: string };

export function useVideoExport() {
  const { projectId, store, studio, assets } = useVideoEditor();
  const { follow, reset: resetGeneration, status, settling, jobStatus, result, error } = useMediaGeneration({
    onDone: () => void assets.loadLibrary(),
  });
  const [preparing, setPreparing] = useState<ExportPhase | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [rendered, setRendered] = useState<VideoDocument | null>(null);
  const current = useEditorState((s) => s.document);
  const cache = useRef(new Map<string, string>());
  const busy = useRef(false);

  const start = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setFailure(null);
    setRendered(null);
    resetGeneration();
    store.getState().commitTransaction();
    try {
      const outcome = await startVideoExport({
        flush: studio.flush,
        committed: studio.committed,
        document: () => store.getState().document,
        rasterize: (target) => rasterizeLayer(target.layer, target.widthPx, target.heightPx, { fontBasePx: target.fontBasePx }),
        upload: (blob, target) => uploadRaster(blob, `studio overlay ${target.clipId}`, "studio-overlay.png"),
        requestExport: (version, rasters) => exportStudioVideoAction(projectId, version, rasters),
        cache: cache.current,
        onPhase: setPreparing,
      });
      if (outcome.status === "started") {
        setRendered(outcome.document);
        void follow(() => Promise.resolve({ data: outcome.job }));
        return;
      }
      if (outcome.status === "conflict") {
        studio.edit({ document: store.getState().document });
        await studio.flush();
        setFailure(studio.committed().settled ? "changed" : "conflict");
        return;
      }
      setFailure(outcome.code);
    } finally {
      setPreparing(null);
      busy.current = false;
    }
  }, [follow, resetGeneration, projectId, store, studio]);

  const reset = useCallback(() => {
    resetGeneration();
    setFailure(null);
    setRendered(null);
  }, [resetGeneration]);

  let state: VideoExportState = { status: "idle" };
  if (preparing) state = { status: "preparing", phase: preparing };
  else if (failure) state = { status: "failed", code: failure };
  else if (status === "generating") {
    state = settling ? { status: "finalizing" } : jobStatus === "running" ? { status: "rendering" } : { status: "queued" };
  } else if (status === "done" && result) state = { status: "done", result, outdated: rendered === null || isExportOutdated(rendered, current) };
  else if (status === "failed" && error) state = { status: "failed", code: error.code };

  return { state, start, reset };
}
