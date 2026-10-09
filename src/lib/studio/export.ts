import type { VideoDocument } from "./document";

export const EXPORT_FAILURES = ["no_encoder", "undecodable", "stalled", "too_large", "renderer_off", "upload_failed", "failed"] as const;
export type ExportFailure = (typeof EXPORT_FAILURES)[number];

export type ExportFailureCode = "empty" | "unsaved" | ExportFailure;

export type ExportPhase = { phase: "saving" } | { phase: "encoding"; done: number; total: number } | { phase: "uploading" };

export interface ExportedVideo {
  mediaId: string;
  mediaUrl: string;
}

export type LocalExport = { status: "done"; result: ExportedVideo } | { status: "failed"; reason: ExportFailure };

export type ExportOutcome = { status: "done"; result: ExportedVideo; document: VideoDocument } | { status: "failed"; code: ExportFailureCode };

export interface ExportDeps {
  flush: () => Promise<void>;
  committed: () => { version: number | null; settled: boolean };
  document: () => VideoDocument;
  local: (document: VideoDocument, onPhase: (phase: ExportPhase) => void) => Promise<LocalExport>;
  onPhase?: (phase: ExportPhase) => void;
}

export async function startVideoExport(deps: ExportDeps): Promise<ExportOutcome> {
  deps.onPhase?.({ phase: "saving" });
  await deps.flush();
  const { version, settled } = deps.committed();
  if (!settled || version === null) return { status: "failed", code: "unsaved" };
  const document = deps.document();
  if (document.durationMs <= 0) return { status: "failed", code: "empty" };
  const local = await deps.local(document, (phase) => deps.onPhase?.(phase));
  if (local.status === "failed") return { status: "failed", code: local.reason };
  return { status: "done", result: local.result, document };
}

export function isExportOutdated(rendered: VideoDocument, current: VideoDocument): boolean {
  return rendered !== current;
}
