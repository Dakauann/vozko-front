import { createStore, type StoreApi } from "zustand/vanilla";

import { isFrame, MP4_EXPORT, type VideoExportFormat, type VideoExportRequest } from "@/lib/studio/animated-export";
import type { Clip, VideoDocument } from "@/lib/studio/document";
import { isExportOutdated, startVideoExport, type ExportDeps, type ExportedMedia, type ExportFailureCode, type ExportPhase, type LocalExport } from "@/lib/studio/export";

export interface ExporterState {
  request: VideoExportRequest;
  preparing: ExportPhase | null;
  failure: ExportFailureCode | null;
  failedClip: Clip | null;
  finished: { result: ExportedMedia; document: VideoDocument } | null;
}

export type VideoExportState =
  | { status: "idle" }
  | { status: "preparing"; phase: ExportPhase; request: VideoExportRequest }
  | { status: "done"; result: ExportedMedia; outdated: boolean; request: VideoExportRequest }
  | { status: "failed"; code: ExportFailureCode; request: VideoExportRequest; clip?: Clip };

export interface VideoExporterDeps extends Omit<ExportDeps, "onPhase" | "local"> {
  local: (document: VideoDocument, request: VideoExportRequest, onPhase: (phase: ExportPhase) => void) => Promise<LocalExport>;
  commit: () => void;
  refreshLibrary: () => void;
}

export interface VideoExporter {
  store: StoreApi<ExporterState>;
  start: (request?: VideoExportRequest) => Promise<void>;
  reset: () => void;
  busy: () => boolean;
}

export function exportStatus(state: ExporterState, current: VideoDocument): VideoExportState {
  const { request } = state;
  if (state.preparing) return { status: "preparing", phase: state.preparing, request };
  if (state.failure) return { status: "failed", code: state.failure, request, ...(state.failedClip ? { clip: state.failedClip } : {}) };
  if (state.finished) return { status: "done", result: state.finished.result, outdated: isExportOutdated(state.finished.document, current), request };
  return { status: "idle" };
}

export interface ExportState {
  store: StoreApi<ExporterState>;
  running: { now: boolean };
}

export function createExportState(): ExportState {
  return { store: createStore<ExporterState>()(() => ({ request: MP4_EXPORT, preparing: null, failure: null, failedClip: null, finished: null })), running: { now: false } };
}

export function createVideoExporter(deps: VideoExporterDeps, state: ExportState = createExportState()): VideoExporter {
  const { store, running } = state;
  const start = async (request: VideoExportRequest = MP4_EXPORT) => {
    if (running.now) return;
    running.now = true;
    store.setState({ request, failure: null, failedClip: null, finished: null });
    deps.commit();
    try {
      const outcome = await startVideoExport({ ...deps, local: (document, onPhase) => deps.local(document, request, onPhase), onPhase: (phase) => store.setState({ preparing: phase }) });
      if (outcome.status === "failed") {
        store.setState({ failure: outcome.code, failedClip: outcome.clip ?? null });
        return;
      }
      store.setState({ finished: { result: outcome.result, document: outcome.document } });
      deps.refreshLibrary();
    } finally {
      store.setState({ preparing: null });
      running.now = false;
    }
  };
  return { store, start, reset: () => store.setState({ failure: null, failedClip: null, finished: null }), busy: () => running.now };
}

interface ExportFacts {
  format: VideoExportFormat;
  from_ms?: number;
  to_ms?: number;
  at_ms?: number;
}

export type ExportSummary =
  | (ExportFacts & { status: "preparing"; phase: ExportPhase["phase"]; progress?: number })
  | (ExportFacts & { status: "done"; media_id: string; url: string; outdated: boolean })
  | (ExportFacts & { status: "failed"; code: ExportFailureCode; clip_id?: string });

function exportFacts(request: VideoExportRequest): ExportFacts {
  if (isFrame(request)) return { format: request.format, at_ms: request.atMs };
  return request.range ? { format: request.format, from_ms: request.range.startMs, to_ms: request.range.endMs } : { format: request.format };
}

export function exportSummary(state: VideoExportState): ExportSummary | null {
  switch (state.status) {
    case "idle":
      return null;
    case "preparing":
      return {
        status: "preparing",
        ...exportFacts(state.request),
        phase: state.phase.phase,
        ...(state.phase.phase === "encoding" && state.phase.total > 0 ? { progress: Math.round((state.phase.done / state.phase.total) * 100) / 100 } : {}),
      };
    case "done":
      return { status: "done", ...exportFacts(state.request), media_id: state.result.mediaId, url: state.result.mediaUrl, outdated: state.outdated };
    case "failed":
      return { status: "failed", ...exportFacts(state.request), code: state.code, ...(state.clip ? { clip_id: state.clip.id } : {}) };
  }
}
